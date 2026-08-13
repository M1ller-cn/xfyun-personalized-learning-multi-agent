param(
    [string]$BaseUrl = "http://127.0.0.1:8080",
    [string]$AdminAccount = "admin",
    [string]$AdminPassword = "123",
    [ValidateSet("admin", "teacher")] [string]$ExpectedRole = "admin"
)

$ErrorActionPreference = "Stop"
$script:passed = [System.Collections.Generic.List[string]]::new()
$script:created = @{}

function Invoke-JsonApi {
    param(
        [Parameter(Mandatory)] [string]$Method,
        [Parameter(Mandatory)] [string]$Path,
        [hashtable]$Headers = @{},
        $Body = $null
    )
    $params = @{ Method = $Method; Uri = "$BaseUrl$Path"; Headers = $Headers; TimeoutSec = 45 }
    if ($null -ne $Body) {
        $json = $Body | ConvertTo-Json -Depth 12 -Compress
        $params.ContentType = "application/json; charset=utf-8"
        $params.Body = [Text.Encoding]::UTF8.GetBytes($json)
    }
    try {
        $response = Invoke-RestMethod @params
    } catch {
        $detail = $_.Exception.Message
        if ($_.Exception.Response) {
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::UTF8)
                $detail = $reader.ReadToEnd()
                $reader.Dispose()
            } catch { }
        }
        throw "HTTP $Method $Path failed: $detail"
    }
    if ($null -ne $response.code -and $response.code -ne 0) {
        throw "API $Method $Path failed: code=$($response.code), message=$($response.message)"
    }
    return $response
}

function Pass([string]$Message) {
    $script:passed.Add($Message)
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Assert-ApiDenied {
    param(
        [Parameter(Mandatory)] [string]$Method,
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] [hashtable]$Headers,
        $Body = $null
    )
    $params = @{ Method = $Method; Uri = "$BaseUrl$Path"; Headers = $Headers; TimeoutSec = 20 }
    if ($null -ne $Body) {
        $json = $Body | ConvertTo-Json -Depth 12 -Compress
        $params.ContentType = "application/json; charset=utf-8"
        $params.Body = [Text.Encoding]::UTF8.GetBytes($json)
    }
    try {
        $response = Invoke-RestMethod @params
        if ($null -eq $response.code -or $response.code -eq 0) {
            throw "Access was unexpectedly allowed: $Method $Path"
        }
    } catch {
        if ($_.Exception.Message -like "Access was unexpectedly allowed:*") { throw }
        # HTTP 401/403 is also an expected denial.
    }
}

function Assert-PdfResponse {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] [hashtable]$Headers
    )
    $response = Invoke-WebRequest -UseBasicParsing -Method POST -Uri "$BaseUrl$Path" -Headers $Headers -TimeoutSec 60
    $contentType = [string]$response.Headers['Content-Type']
    $bytes = [byte[]]$response.Content
    if ($contentType -notlike 'application/pdf*' -or $bytes.Length -lt 1000) {
        throw "Invalid PDF response from ${Path}: type=$contentType bytes=$($bytes.Length)"
    }
    $signature = [Text.Encoding]::ASCII.GetString($bytes[0..3])
    if ($signature -ne '%PDF') { throw "Missing PDF signature from $Path" }
}

function Try-Cleanup([scriptblock]$Action, [string]$Name) {
    try { & $Action | Out-Null; Write-Host "[CLEAN] $Name" -ForegroundColor DarkGray }
    catch { Write-Warning "Cleanup failed for ${Name}: $($_.Exception.Message)" }
}

$runId = (Get-Date -Format "MMddHHmmss") + (Get-Random -Minimum 10 -Maximum 99)

try {
    $login = Invoke-JsonApi POST "/api/auth/login" -Body @{ userAccount = $AdminAccount; userPassword = $AdminPassword }
    $adminToken = $login.data.token
    $adminId = [long]$login.data.id
    $adminHeaders = @{ Authorization = "Bearer $adminToken" }
    if ($login.data.userRole -ne $ExpectedRole) { throw "Expected $ExpectedRole role, got $($login.data.userRole)" }
    $courseTeacherId = $adminId
    if ($ExpectedRole -eq "teacher") {
        $teacherProfile = Invoke-JsonApi GET "/api/teacher/my" -Headers $adminHeaders
        $courseTeacherId = [long]$teacherProfile.data.id
    }
    Pass "Operator login and $ExpectedRole role"

    $studentPhone = "139" + ($runId.PadLeft(8, "0").Substring($runId.Length - 8, 8))
    $studentLogin = Invoke-JsonApi POST "/api/auth/login/phone" -Body @{ phone = $studentPhone; smsCode = "542899" }
    $studentId = [long]$studentLogin.data.id
    $studentHeaders = @{ Authorization = "Bearer $($studentLogin.data.token)" }
    if ($studentLogin.data.userRole -ne "student") { throw "Expected student role, got $($studentLogin.data.userRole)" }
    Pass "Student OTP login"

    Assert-ApiDenied POST "/api/course" -Headers $studentHeaders -Body @{
        title = "Denied-Course-$runId"; teacherId = $adminId; price = 0; courseType = 0; difficulty = 1
    }
    Assert-ApiDenied POST "/api/questions" -Headers $studentHeaders -Body @{
        type = "SINGLE_CHOICE"; subject = "COMPUTER_SCIENCE"; grade = "university"; difficulty = 1
        content = "Denied question"; options = '[]'; answer = "A"; knowledgeTags = @(); source = "MANUAL"
    }
    Assert-ApiDenied POST "/api/exam-papers" -Headers $studentHeaders -Body @{
        title = "Denied-Paper-$runId"; subject = "COMPUTER_SCIENCE"; grade = "university"; durationMin = 30; layout = "{}"
    }
    Assert-ApiDenied POST "/api/ai/knowledge-bases?userId=$adminId" -Headers $studentHeaders -Body @{
        name = "Denied-KB-$runId"; embeddingModel = "text-embedding-v4"; embeddingDimension = 1024
        chunkSize = 500; chunkOverlap = 80; chunkStrategy = "RECURSIVE"; retrievalMode = "HYBRID_RERANK"
    }
    Pass "Student write access is denied"

    $class = Invoke-JsonApi POST "/api/classes" -Headers $adminHeaders -Body @{
        className = "QA-Class-$runId"
        description = "Temporary teacher E2E audit class"
    }
    $classId = [long]$class.data.id
    $script:created.classId = $classId
    $classDetail = Invoke-JsonApi GET "/api/classes/${classId}" -Headers $adminHeaders
    if ($classDetail.data.className -ne "QA-Class-$runId") { throw "Class detail mismatch" }
    Pass "Create and read class"

    Invoke-JsonApi POST "/api/classes/${classId}/members" -Headers $adminHeaders -Body @{ userId = $studentId; role = "student" } | Out-Null
    $members = Invoke-JsonApi GET "/api/classes/${classId}/members?pageNum=1&pageSize=20" -Headers $adminHeaders
    if (-not ($members.data.list | Where-Object { [long]$_.userId -eq $studentId })) { throw "Student missing from class" }
    Pass "Add and list class member"

    $course = Invoke-JsonApi POST "/api/course" -Headers $adminHeaders -Body @{
        title = "QA-Algorithms-$runId"
        subtitle = "Teacher publish flow audit"
        description = "Temporary course with chapter, external video and resource"
        coverImage = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200"
        price = 0
        courseType = 0
        difficulty = 2
        teacherId = $courseTeacherId
        tags = @("algorithms", "qa-audit")
    }
    $courseId = [long]$course.data
    $script:created.courseId = $courseId
    Pass "Create course"

    $chapter = Invoke-JsonApi POST "/api/course/${courseId}/chapter" -Headers $adminHeaders -Body @{
        title = "Chapter 1 Algorithm Analysis"
        description = "Complexity and basic algorithms"
        sort = 1
    }
    $chapterId = [long]$chapter.data
    $section = Invoke-JsonApi POST "/api/course/${courseId}/section" -Headers $adminHeaders -Body @{
        chapterId = $chapterId
        title = "Introduction to Complexity"
        description = "External open course resource"
        videoUrl = "https://www.youtube.com/watch?v=ZA-tUyM_y7s"
        resourceUrl = "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/"
        duration = 2700
        sort = 1
        isFree = $true
    }
    $sectionId = [long]$section.data
    $structure = Invoke-JsonApi GET "/api/course/${courseId}/structure" -Headers $adminHeaders
    if ($structure.data.chapters.Count -lt 1) { throw "Course structure has no chapter" }
    Pass "Create chapter, section, video and resource"

    Invoke-JsonApi POST "/api/course/${courseId}/publish" -Headers $adminHeaders | Out-Null
    $courseDetail = Invoke-JsonApi GET "/api/course/${courseId}" -Headers $adminHeaders
    if ([int]$courseDetail.data.status -ne 1) { throw "Course not published" }
    $joinCode = [string]$courseDetail.data.joinCode
    if ([string]::IsNullOrWhiteSpace($joinCode)) { throw "Course has no join code" }
    Pass "Publish course and generate join code"

    Invoke-JsonApi POST "/api/classes/${classId}/courses" -Headers $adminHeaders -Body @{ courseId = $courseId } | Out-Null
    Pass "Bind course to class"

    $joined = Invoke-JsonApi POST "/api/course/join-by-code" -Headers $studentHeaders -Body @{ code = $joinCode }
    if ([long]$joined.data.id -ne $courseId) { throw "Joined course mismatch" }
    $myCourses = Invoke-JsonApi GET "/api/course/my?page=1&size=20" -Headers $studentHeaders
    if (-not ($myCourses.data | Where-Object { [long]$_.id -eq $courseId })) { throw "Course missing from student list" }
    Pass "Student joins course by code"

    $question = Invoke-JsonApi POST "/api/questions" -Headers $adminHeaders -Body @{
        type = "SINGLE_CHOICE"
        subject = "COMPUTER_SCIENCE"
        grade = "university"
        difficulty = 2
        content = "What is the time complexity of binary search?"
        options = '[{"key":"A","value":"O(1)"},{"key":"B","value":"O(log n)"},{"key":"C","value":"O(n)"},{"key":"D","value":"O(n^2)"}]'
        answer = "B"
        explanation = "The search interval is halved each iteration."
        knowledgeTags = @("binary-search", "complexity")
        source = "MANUAL"
    }
    $questionId = [long]$question.data
    $script:created.questionId = $questionId
    $questionDetail = Invoke-JsonApi GET "/api/questions/${questionId}" -Headers $adminHeaders
    if ($questionDetail.data.answer -ne "B") { throw "Question answer mismatch" }
    Pass "Create and read question"

    $paper = Invoke-JsonApi POST "/api/exam-papers" -Headers $adminHeaders -Body @{
        title = "QA-Algorithm-Exam-$runId"
        subtitle = "Teacher publish audit"
        subject = "COMPUTER_SCIENCE"
        grade = "university"
        durationMin = 30
        layout = "{}"
    }
    $paperId = [long]$paper.data
    $script:created.paperId = $paperId
    $paperSection = Invoke-JsonApi POST "/api/exam-papers/${paperId}/sections" -Headers $adminHeaders -Body @{
        title = "Single Choice"
        description = "Choose the correct answer"
        questionType = "SINGLE_CHOICE"
        sortOrder = 1
    }
    $paperSectionId = [long]$paperSection.data
    Invoke-JsonApi POST "/api/exam-papers/${paperId}/sections/${paperSectionId}/questions" -Headers $adminHeaders -Body @{ questionId = $questionId; score = 10; sortOrder = 1 } | Out-Null
    Invoke-JsonApi POST "/api/exam-papers/${paperId}/publish" -Headers $adminHeaders | Out-Null
    $paperQuestions = Invoke-JsonApi GET "/api/exam-papers/${paperId}/sections/${paperSectionId}/questions" -Headers $adminHeaders
    if ($paperQuestions.data.Count -lt 1) { throw "Paper has no questions" }
    Assert-PdfResponse "/api/exam-papers/${paperId}/preview" -Headers $adminHeaders
    Assert-PdfResponse "/api/exam-papers/${paperId}/export-answer-key" -Headers $adminHeaders
    Pass "Create, publish, preview and export exam paper"

    $kb = Invoke-JsonApi POST "/api/ai/knowledge-bases?userId=$adminId" -Headers $adminHeaders -Body @{
        name = "QA-KB-$runId"
        description = "Temporary teacher knowledge base audit"
        embeddingModel = "text-embedding-v4"
        embeddingDimension = 1024
        chunkSize = 500
        chunkOverlap = 80
        chunkStrategy = "RECURSIVE"
        parentChildMode = $false
        preserveMetadata = $true
        retrievalMode = "HYBRID_RERANK"
        enableQueryRewrite = $false
        useDynamicTopK = $false
        defaultTopK = 5
        rerankModel = "qwen3-rerank"
    }
    $kbId = [long]$kb.data.id
    $script:created.kbId = $kbId
    $kbList = Invoke-JsonApi GET "/api/ai/knowledge-bases?userId=$adminId&page=0&size=20" -Headers $adminHeaders
    $kbItems = @($kbList.data)
    if (-not ($kbItems | Where-Object { [long]$_.id -eq $kbId })) {
        throw "Knowledge base missing. expected=$kbId actual=$((@($kbItems | ForEach-Object { $_.id })) -join ',')"
    }
    Pass "Create and list knowledge base"

    foreach ($analyticsPath in @("overview", "ranking", "trend", "subjects")) {
        $analytics = Invoke-JsonApi GET "/api/analytics/class/${classId}/${analyticsPath}" -Headers $adminHeaders
        if ($analytics.code -ne 0) { throw "Analytics failed: $analyticsPath" }
    }
    Pass "Class analytics endpoints"

    Write-Host ""
    Write-Host "Teacher E2E audit passed: $($script:passed.Count) checks" -ForegroundColor Cyan
    $script:passed | ForEach-Object { Write-Host "  - $_" }
}
finally {
    if ($script:created.kbId) { Try-Cleanup { Invoke-JsonApi DELETE "/api/ai/knowledge-bases/$($script:created.kbId)" -Headers $adminHeaders } "knowledge base" }
    if ($script:created.paperId) { Try-Cleanup { Invoke-JsonApi DELETE "/api/exam-papers/$($script:created.paperId)" -Headers $adminHeaders } "exam paper" }
    if ($script:created.questionId) { Try-Cleanup { Invoke-JsonApi DELETE "/api/questions/$($script:created.questionId)" -Headers $adminHeaders } "question" }
    if ($script:created.classId) { Try-Cleanup { Invoke-JsonApi DELETE "/api/classes/$($script:created.classId)" -Headers $adminHeaders } "class" }
    if ($script:created.courseId) { Try-Cleanup { Invoke-JsonApi DELETE "/api/course/$($script:created.courseId)" -Headers $adminHeaders } "course" }
}
