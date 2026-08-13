param(
    [string]$BaseUrl = "http://127.0.0.1:8080",
    [string]$AdminAccount = "admin",
    [string]$AdminPassword = "123"
)

$ErrorActionPreference = "Stop"
$script:passed = [System.Collections.Generic.List[string]]::new()
$script:created = @{}

function Invoke-JsonApi {
    param([string]$Method, [string]$Path, [hashtable]$Headers = @{}, $Body = $null)
    $params = @{ Method = $Method; Uri = "$BaseUrl$Path"; Headers = $Headers; TimeoutSec = 60 }
    if ($null -ne $Body) {
        $params.ContentType = "application/json; charset=utf-8"
        $params.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 10 -Compress))
    }
    try { $response = Invoke-RestMethod @params }
    catch { throw "HTTP $Method $Path failed: $($_.Exception.Message)" }
    if ($null -ne $response.code -and $response.code -ne 0) { throw "API $Method $Path failed: $($response.message)" }
    return $response
}

function Pass([string]$Message) {
    $script:passed.Add($Message)
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Assert-ApiDenied {
    param([string]$Method, [string]$Path, [hashtable]$Headers, $Body = $null)
    $params = @{ Method = $Method; Uri = "$BaseUrl$Path"; Headers = $Headers; TimeoutSec = 25 }
    if ($null -ne $Body) {
        $params.ContentType = "application/json; charset=utf-8"
        $params.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 8 -Compress))
    }
    try {
        $response = Invoke-RestMethod @params
        if ($null -eq $response.code -or $response.code -eq 0) { throw "Access unexpectedly allowed: $Method $Path" }
    } catch {
        if ($_.Exception.Message -like "Access unexpectedly allowed:*") { throw }
    }
}

function Find-OrCreateDemoUser {
    param([string]$Account, [string]$Name, [string]$Role, [hashtable]$AdminHeaders)
    $query = Invoke-JsonApi POST "/api/user/admin/list" -Headers $AdminHeaders -Body @{ userAccount = $Account; pageNum = 1; pageSize = 10 }
    $found = @($query.data.users | Where-Object { $_.userAccount -eq $Account }) | Select-Object -First 1
    if ($found) { return $found }
    $created = Invoke-JsonApi POST "/api/user/admin/create" -Headers $AdminHeaders -Body @{
        userAccount = $Account; userPassword = "123456"; userName = $Name; role = $Role
    }
    return [PSCustomObject]@{ id = $created.data; userAccount = $Account; role = $Role }
}

function Ensure-TeacherProfile {
    param([string]$Account, [hashtable]$AdminHeaders)
    $login = Invoke-JsonApi POST "/api/auth/login" -Body @{ userAccount = $Account; userPassword = "123456" }
    $headers = @{ Authorization = "Bearer $($login.data.token)" }
    if ($login.data.userRole -eq "teacher") { return @{ Login = $login; Headers = $headers } }
    $application = Invoke-JsonApi POST "/api/teacher/apply" -Headers $headers -Body @{
        name = "Demo Teacher B"; introduction = "Platform permission and teaching-flow audit account"; expertise = @("algorithms", "programming")
    }
    Invoke-JsonApi POST "/api/teacher/application/review" -Headers $AdminHeaders -Body @{ applicationId = $application.data; approved = $true } | Out-Null
    $teacherLogin = Invoke-JsonApi POST "/api/auth/login" -Body @{ userAccount = $Account; userPassword = "123456" }
    return @{ Login = $teacherLogin; Headers = @{ Authorization = "Bearer $($teacherLogin.data.token)" } }
}

try {
    $adminLogin = Invoke-JsonApi POST "/api/auth/login" -Body @{ userAccount = $AdminAccount; userPassword = $AdminPassword }
    $adminHeaders = @{ Authorization = "Bearer $($adminLogin.data.token)" }
    if ($adminLogin.data.userRole -ne "admin") { throw "Expected admin role" }
    Pass "Administrator login"

    $readiness = Invoke-JsonApi GET "/api/platform/readiness" -Headers $adminHeaders
    if (-not $readiness.data.ready) { throw "Platform readiness check failed" }
    Pass "Platform readiness"

    $student = Find-OrCreateDemoUser -Account "demo_student" -Name "Demo Student" -Role "student" -AdminHeaders $adminHeaders
    $teacherBUser = Find-OrCreateDemoUser -Account "demo_teacher_b" -Name "Demo Teacher B" -Role "student" -AdminHeaders $adminHeaders
    $studentLogin = Invoke-JsonApi POST "/api/auth/login" -Body @{ userAccount = "demo_student"; userPassword = "123456" }
    if ($studentLogin.data.userRole -ne "student") { throw "Demo student has wrong role" }
    $studentHeaders = @{ Authorization = "Bearer $($studentLogin.data.token)" }
    $teacherB = Ensure-TeacherProfile -Account "demo_teacher_b" -AdminHeaders $adminHeaders
    if ($teacherB.Login.data.userRole -ne "teacher") { throw "Demo teacher B has wrong role" }
    Pass "Fixed demo accounts"

    $teacherLogin = Invoke-JsonApi POST "/api/auth/login" -Body @{ userAccount = "teacher"; userPassword = "123456" }
    $teacherHeaders = @{ Authorization = "Bearer $($teacherLogin.data.token)" }
    $teacherProfile = Invoke-JsonApi GET "/api/teacher/my" -Headers $teacherHeaders
    $course = Invoke-JsonApi POST "/api/course" -Headers $teacherHeaders -Body @{
        title = "QA-Evidence-Course-$(Get-Date -Format HHmmss)"; subtitle = "Platform E2E"; description = "Temporary evidence audit course"
        coverImage = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200"; price = 0; courseType = 0; difficulty = 1
        teacherId = $teacherProfile.data.id; tags = @("qa", "evidence")
    }
    $courseId = [long]$course.data
    $script:created.courseId = $courseId
    $chapter = Invoke-JsonApi POST "/api/course/${courseId}/chapter" -Headers $teacherHeaders -Body @{ title = "Evidence chapter"; description = "Test chapter"; sort = 1 }
    $section = Invoke-JsonApi POST "/api/course/${courseId}/section" -Headers $teacherHeaders -Body @{
        chapterId = $chapter.data; title = "Evidence video"; description = "External video"; videoUrl = "https://www.youtube.com/watch?v=ZA-tUyM_y7s"
        resourceUrl = "https://ocw.mit.edu/"; duration = 300; sort = 1; isFree = $true
    }
    Invoke-JsonApi POST "/api/course/${courseId}/publish" -Headers $teacherHeaders | Out-Null
    $courseDetail = Invoke-JsonApi GET "/api/course/${courseId}" -Headers $teacherHeaders
    Pass "Teacher creates publishable course content"

    Assert-ApiDenied POST "/api/course/${courseId}/offline" -Headers $teacherB.Headers
    Assert-ApiDenied DELETE "/api/course/${courseId}" -Headers $teacherB.Headers
    Pass "Teacher B cannot manage Teacher A course"

    Invoke-JsonApi POST "/api/course/join-by-code" -Headers $studentHeaders -Body @{ code = $courseDetail.data.joinCode } | Out-Null
    Invoke-JsonApi POST "/api/progress" -Headers $studentHeaders -Body @{
        courseId = $courseId; sectionId = $section.data; lastPosition = 75; watchDuration = 75; progress = 25
    } | Out-Null
    $events = Invoke-JsonApi GET "/api/learning-events/me?limit=20" -Headers $studentHeaders
    if (-not (@($events.data | Where-Object { $_.eventType -eq "VIDEO_PROGRESS" -and [long]$_.courseId -eq $courseId }))) {
        throw "Video progress did not enter the learning event stream"
    }
    Pass "Student course join and video evidence"

    $code = "import sys`nprint(sum(map(int, sys.stdin.read().split())))"
    $judge = Invoke-JsonApi POST "/api/grading/code-judge/run-custom" -Headers $studentHeaders -Body @{
        language = "python"; code = $code; courseId = $courseId; knowledgePoint = "input-output"
        tests = @(@{ id = "sample"; input = "1 2"; expectedOutput = "3" })
    }
    if ($judge.data.verdict -ne "ACCEPTED") { throw "Code judge smoke test failed" }
    Pass "Student code judge"

    $profileWorkspace = Invoke-JsonApi POST "/api/learning-workspace/profile/analyze" -Headers $studentHeaders -Body @{
        message = "I am preparing for an algorithms final. I have one hour daily, struggle with binary search and dynamic programming, and want more practice and coding."
    }
    if (-not $profileWorkspace.data.profileInitialized) { throw "Profile did not initialize" }
    $topicId = $profileWorkspace.data.path[0].id
    $evaluation = Invoke-JsonApi POST "/api/learning-workspace/quiz/evaluate" -Headers $studentHeaders -Body @{
        courseKey = $profileWorkspace.data.course.key; nodeId = $topicId; answer = "I identify the input size, define the recurrence and base cases, then derive time complexity."
    }
    if ($null -eq $evaluation.data.score) { throw "Learning evaluation did not return a score" }
    $eventsAfterQuiz = Invoke-JsonApi GET "/api/learning-events/me?limit=30" -Headers $studentHeaders
    if (-not (@($eventsAfterQuiz.data | Where-Object { $_.eventType -eq "QUIZ_SUBMITTED" }))) { throw "Quiz evidence missing" }
    Pass "Profile initialization and learning evaluation evidence"

    $diagnostic = Invoke-JsonApi POST "/api/learning-workspace/quiz/evaluate" -Headers $studentHeaders -Body @{
        courseKey = $profileWorkspace.data.course.key; nodeId = $topicId; assessmentType = "DIAGNOSTIC"
        answer = "Before learning, I would identify the core definition and the inputs, but I am unsure about edge cases and proof."
    }
    $transfer = Invoke-JsonApi POST "/api/learning-workspace/quiz/evaluate" -Headers $studentHeaders -Body @{
        courseKey = $profileWorkspace.data.course.key; nodeId = $topicId; assessmentType = "TRANSFER"
        answer = "For a new scenario, I identify the input size and constraints, select an appropriate algorithmic model, explain the steps, analyze complexity, and test an empty or boundary case."
    }
    $effect = Invoke-JsonApi GET "/api/learning-workspace/effectiveness/overview?courseKey=$($profileWorkspace.data.course.key)" -Headers $studentHeaders
    $topicEffect = @($effect.data.topics | Where-Object { $_.topicId -eq $topicId }) | Select-Object -First 1
    if (-not $topicEffect -or $topicEffect.diagnosticScore -lt 0 -or $topicEffect.transferScore -lt 0) { throw "Diagnostic and transfer evidence missing" }
    if ($topicEffect.verified) { throw "A topic was incorrectly verified before delayed retention testing" }
    Pass "Learning effectiveness requires diagnostic, transfer, and delayed retention evidence"

    $activeCourse = $profileWorkspace.data.course.key
    $nextCourseMessage = if ($activeCourse -eq "cs61b") {
        "I want to study CS50x SQL programming next."
    } else {
        "I also want to study Java and data structures next."
    }
    $pendingSwitch = Invoke-JsonApi POST "/api/learning-workspace/profile/analyze" -Headers $studentHeaders -Body @{ message = $nextCourseMessage }
    if ($pendingSwitch.data.course.key -ne $activeCourse) { throw "Profile changed course before learner confirmation" }
    $confirmedSwitch = Invoke-JsonApi POST "/api/learning-workspace/profile/analyze" -Headers $studentHeaders -Body @{ message = "Keep my existing goals and switch to the new course." }
    if ($confirmedSwitch.data.course.key -eq $activeCourse) { throw "Confirmed course switch did not use the pending course" }
    $overview = Invoke-JsonApi GET "/api/learning-workspace/profile/overview" -Headers $studentHeaders
    $activeGoals = @($overview.data.goals | Where-Object { $_.status -eq "ACTIVE" })
    if (-not ($activeGoals | Where-Object { $_.priority -eq "CURRENT" -and $_.courseKey -eq $confirmedSwitch.data.course.key })) {
        throw "New current goal missing after confirmed course switch"
    }
    if (-not ($activeGoals | Where-Object { $_.priority -eq "LONG_TERM" -and $_.courseKey -eq $activeCourse })) {
        throw "Original goal was not preserved as a long-term goal"
    }
    Pass "Profile preserves goals and applies confirmed course changes"

    $sprint = Invoke-JsonApi POST "/api/learning-workspace/path/mode" -Headers $studentHeaders -Body @{
        courseKey = $confirmedSwitch.data.course.key; mode = "EXAM_SPRINT"
    }
    if ($sprint.data.pathMode -ne "EXAM_SPRINT") { throw "Path mode was not saved" }
    $pathHistory = Invoke-JsonApi GET "/api/learning-workspace/path/history" -Headers $studentHeaders -Body $null
    if (-not @($pathHistory.data | Where-Object { $_.mode -eq "EXAM_SPRINT" })) { throw "Path adjustment history missing" }
    Pass "Dynamic path mode and adjustment history"

    Write-Host ""; Write-Host "Platform E2E audit passed: $($script:passed.Count) checks" -ForegroundColor Cyan
    $script:passed | ForEach-Object { Write-Host "  - $_" }
}
finally {
    if ($script:created.courseId -and $teacherHeaders) {
        try { Invoke-JsonApi DELETE "/api/course/$($script:created.courseId)" -Headers $teacherHeaders | Out-Null; Write-Host "[CLEAN] temporary course" -ForegroundColor DarkGray }
        catch { Write-Warning "Temporary course cleanup failed: $($_.Exception.Message)" }
    }
}
