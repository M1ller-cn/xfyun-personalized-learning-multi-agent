-- Open computer science course seeds.
-- The platform stores course structure and external resource links only.

DO $$
DECLARE
    v_admin_id BIGINT;
    v_teacher_id BIGINT;
    v_course_id BIGINT;
    v_chapter_id BIGINT;
BEGIN
    SELECT id INTO v_admin_id FROM "user" WHERE user_account = 'admin' LIMIT 1;
    IF v_admin_id IS NULL THEN
        RAISE NOTICE 'Skip open CS course seed: admin user does not exist yet.';
        RETURN;
    END IF;

    SELECT id INTO v_teacher_id FROM teacher WHERE name = 'Open Course Curator' LIMIT 1;
    IF v_teacher_id IS NULL THEN
        INSERT INTO teacher (name, introduction, expertise, user_id, admin_id)
        VALUES (
            'Open Course Curator',
            'Curated external open courses for computer science self-learning. Links point to official course pages, public videos, assignments, projects, and labs.',
            '["计算机科学","数据结构","算法","程序设计","计算机系统"]',
            v_admin_id,
            v_admin_id
        )
        RETURNING id INTO v_teacher_id;
    END IF;

    -- MIT 6.006 Introduction to Algorithms
    SELECT id INTO v_course_id FROM course WHERE title = 'MIT 6.006 Introduction to Algorithms' AND is_delete = 0 LIMIT 1;
    IF v_course_id IS NULL THEN
        INSERT INTO course (title, subtitle, description, cover_image, price, course_type, difficulty, status, teacher_id,
                            total_duration, total_chapters, total_sections, student_count, rating_score, tags, admin_id)
        VALUES (
            'MIT 6.006 Introduction to Algorithms',
            '算法设计与分析，含公开视频、Problem Sets、Programming Assignments、Exams',
            'MIT OpenCourseWare 6.006 is a rigorous algorithms course covering algorithmic thinking, sorting, hashing, trees, graphs, shortest paths, dynamic programming, and complexity. Use it as the core algorithm-design course.',
            'https://ocw.mit.edu/static_shared/images/ocw_logo_black.png',
            0, 0, 3, 1, v_teacher_id, 43200, 8, 8, 520, 4.9,
            '["MIT","算法设计","数据结构","Python","Problem Sets","公开课"]',
            v_admin_id
        )
        RETURNING id INTO v_course_id;

        INSERT INTO course_chapter (course_id, title, description, sort, admin_id)
        VALUES (v_course_id, '算法基础与排序', '从 peak finding、计算模型、插入排序、归并排序进入算法分析。', 10, v_admin_id)
        RETURNING id INTO v_chapter_id;
        INSERT INTO course_section (course_id, chapter_id, title, description, video_url, resource_url, duration, sort, is_free, admin_id)
        VALUES
        (v_course_id, v_chapter_id, 'Lecture Videos', '官方视频列表，配套 transcript 与 lecture notes。', 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/video_galleries/lecture-videos/', 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/pages/assignments/', 7200, 10, 1, v_admin_id),
        (v_course_id, v_chapter_id, 'Assignments and Exams', 'Problem Sets、编程作业示例、考试与解答。', 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/resources/lecture-1-algorithmic-thinking-peak-finding/', 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/pages/assignments/', 7200, 20, 1, v_admin_id);

        INSERT INTO course_chapter (course_id, title, description, sort, admin_id)
        VALUES (v_course_id, '树、哈希、图与动态规划', '把数据结构和算法范式放到真实问题中训练。', 20, v_admin_id)
        RETURNING id INTO v_chapter_id;
        INSERT INTO course_section (course_id, chapter_id, title, description, video_url, resource_url, duration, sort, is_free, admin_id)
        VALUES
        (v_course_id, v_chapter_id, 'Trees, Hashing, Graphs', '二叉搜索树、哈希、图搜索与最短路。', 'https://www.youtube.com/playlist?list=PLUl4u3cNGP61Oq3tWYp6V_F-5jb5L2iHb', 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/', 14400, 10, 1, v_admin_id),
        (v_course_id, v_chapter_id, 'Dynamic Programming and Complexity', '动态规划、复杂性、综合复习和考试训练。', 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/resources/lecture-videos/', 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/pages/assignments/', 14400, 20, 1, v_admin_id);
    END IF;

    -- UC Berkeley CS 61A
    SELECT id INTO v_course_id FROM course WHERE title = 'UC Berkeley CS 61A Structure and Interpretation of Computer Programs' AND is_delete = 0 LIMIT 1;
    IF v_course_id IS NULL THEN
        INSERT INTO course (title, subtitle, description, cover_image, price, course_type, difficulty, status, teacher_id,
                            total_duration, total_chapters, total_sections, student_count, rating_score, tags, admin_id)
        VALUES (
            'UC Berkeley CS 61A Structure and Interpretation of Computer Programs',
            'Python 程序设计、抽象、递归、解释器、项目制训练',
            'CS 61A is a strong entry course for programming maturity: functions, recursion, higher-order functions, data abstraction, trees, interpreters, and projects.',
            'https://cs61a.org/assets/images/banner.png',
            0, 0, 2, 1, v_teacher_id, 39600, 5, 5, 430, 4.8,
            '["Berkeley","Python","SICP","项目","Lab","Homework"]',
            v_admin_id
        )
        RETURNING id INTO v_course_id;

        INSERT INTO course_chapter (course_id, title, description, sort, admin_id)
        VALUES (v_course_id, 'Python 抽象与递归', '函数、环境模型、递归、树递归和数据抽象。', 10, v_admin_id)
        RETURNING id INTO v_chapter_id;
        INSERT INTO course_section (course_id, chapter_id, title, description, video_url, resource_url, duration, sort, is_free, admin_id)
        VALUES
        (v_course_id, v_chapter_id, 'Course Home and Calendar', '课程主页包含 lectures、labs、homeworks、projects。', 'https://cs61a.org/', 'https://cs61a.org/', 10800, 10, 1, v_admin_id),
        (v_course_id, v_chapter_id, 'Projects', '项目把课程概念组合成完整程序，适合平台拆成阶段任务。', 'https://www.youtube.com/watch?v=CoHCUimLmdM', 'https://cs61a.org/articles/about-61a/', 10800, 20, 1, v_admin_id);

        INSERT INTO course_chapter (course_id, title, description, sort, admin_id)
        VALUES (v_course_id, '解释器与程序设计思想', 'Scheme、SQL、解释器项目和综合复盘。', 20, v_admin_id)
        RETURNING id INTO v_chapter_id;
        INSERT INTO course_section (course_id, chapter_id, title, description, video_url, resource_url, duration, sort, is_free, admin_id)
        VALUES
        (v_course_id, v_chapter_id, 'Archived Full Course', '历史归档含录播、slides、labs、homeworks、projects。', 'https://insideempire.github.io/CS61A-Website-Archive/', 'https://insideempire.github.io/CS61A-Website-Archive/', 18000, 10, 1, v_admin_id);
    END IF;

    -- UC Berkeley CS 61B
    SELECT id INTO v_course_id FROM course WHERE title = 'UC Berkeley CS 61B Data Structures' AND is_delete = 0 LIMIT 1;
    IF v_course_id IS NULL THEN
        INSERT INTO course (title, subtitle, description, cover_image, price, course_type, difficulty, status, teacher_id,
                            total_duration, total_chapters, total_sections, student_count, rating_score, tags, admin_id)
        VALUES (
            'UC Berkeley CS 61B Data Structures',
            'Java 数据结构、工程化项目、测试、抽象数据类型',
            'CS 61B is a project-heavy data structures course. It is ideal for adding auto-graded coding tasks: deques, trees, hash maps, sorting, graphs, and software engineering practice.',
            'https://sp25.datastructur.es/img/favicon.png',
            0, 0, 3, 1, v_teacher_id, 43200, 5, 5, 510, 4.9,
            '["Berkeley","数据结构","Java","项目","自动评测","工程实践"]',
            v_admin_id
        )
        RETURNING id INTO v_course_id;

        INSERT INTO course_chapter (course_id, title, description, sort, admin_id)
        VALUES (v_course_id, 'Java 与抽象数据类型', 'Java 语法、对象、接口、链表、数组表、双端队列。', 10, v_admin_id)
        RETURNING id INTO v_chapter_id;
        INSERT INTO course_section (course_id, chapter_id, title, description, video_url, resource_url, duration, sort, is_free, admin_id)
        VALUES
        (v_course_id, v_chapter_id, 'Spring 2025 Course Site', '课程站点含 homework、projects、labs、slides。', 'https://sp25.datastructur.es/', 'https://sp25.datastructur.es/', 14400, 10, 1, v_admin_id),
        (v_course_id, v_chapter_id, 'Classic CS61B Lectures', 'Jonathan Shewchuk 版本公开视频，可作补充讲解。', 'https://www.youtube.com/playlist?list=PLu0nzW8Es1x3TmpwQRLMQwCtulEd43ZY8', 'https://people.eecs.berkeley.edu/~jrs/61b/', 14400, 20, 1, v_admin_id);

        INSERT INTO course_chapter (course_id, title, description, sort, admin_id)
        VALUES (v_course_id, '项目与评测任务', '2048、Deque、Gitlet 等项目适合拆成平台代码题和测试点。', 20, v_admin_id)
        RETURNING id INTO v_chapter_id;
        INSERT INTO course_section (course_id, chapter_id, title, description, video_url, resource_url, duration, sort, is_free, admin_id)
        VALUES
        (v_course_id, v_chapter_id, 'Homework and Projects', '把项目拆成里程碑、样例测试、隐藏测试与讲解。', 'https://fa23.datastructur.es/', 'https://fa23.datastructur.es/', 14400, 10, 1, v_admin_id);
    END IF;

    -- Nand2Tetris
    SELECT id INTO v_course_id FROM course WHERE title = 'Nand2Tetris Building a Modern Computer From First Principles' AND is_delete = 0 LIMIT 1;
    IF v_course_id IS NULL THEN
        INSERT INTO course (title, subtitle, description, cover_image, price, course_type, difficulty, status, teacher_id,
                            total_duration, total_chapters, total_sections, student_count, rating_score, tags, admin_id)
        VALUES (
            'Nand2Tetris Building a Modern Computer From First Principles',
            '从 NAND 门到操作系统，12 个项目搭出一台计算机',
            'Nand2Tetris is project-centered and self-contained: lectures, tools, project specs, and tests for building a computer system and software hierarchy from the ground up.',
            'https://www.nand2tetris.org/favicon.ico',
            0, 0, 3, 1, v_teacher_id, 36000, 4, 4, 460, 4.9,
            '["计算机系统","硬件","汇编","编译器","项目制","开源"]',
            v_admin_id
        )
        RETURNING id INTO v_course_id;

        INSERT INTO course_chapter (course_id, title, description, sort, admin_id)
        VALUES (v_course_id, '硬件部分', 'NAND、组合逻辑、时序逻辑、ALU、CPU、机器语言。', 10, v_admin_id)
        RETURNING id INTO v_chapter_id;
        INSERT INTO course_section (course_id, chapter_id, title, description, video_url, resource_url, duration, sort, is_free, admin_id)
        VALUES
        (v_course_id, v_chapter_id, 'Official Course and Projects', '官网提供 lectures、project materials、tools。', 'https://www.nand2tetris.org/', 'https://www.nand2tetris.org/course', 18000, 10, 1, v_admin_id),
        (v_course_id, v_chapter_id, 'Part I Coursera', '六个硬件项目，从逻辑门到通用计算机。', 'https://www.coursera.org/learn/build-a-computer', 'https://www.nand2tetris.org/course', 18000, 20, 1, v_admin_id);

        INSERT INTO course_chapter (course_id, title, description, sort, admin_id)
        VALUES (v_course_id, '软件部分', '汇编器、虚拟机、编译器、操作系统和高级语言程序。', 20, v_admin_id)
        RETURNING id INTO v_chapter_id;
        INSERT INTO course_section (course_id, chapter_id, title, description, video_url, resource_url, duration, sort, is_free, admin_id)
        VALUES
        (v_course_id, v_chapter_id, '12 Projects Roadmap', '每个项目有 project guidelines 和 lecture slides。', 'https://www.youtube.com/playlist?list=PLxrmhEW0PGtW6nGXE1f-H4hFKta4p_R55', 'https://www.nand2tetris.org/course', 18000, 10, 1, v_admin_id);
    END IF;

    -- Harvard CS50x
    SELECT id INTO v_course_id FROM course WHERE title = 'Harvard CS50x Introduction to Computer Science' AND is_delete = 0 LIMIT 1;
    IF v_course_id IS NULL THEN
        INSERT INTO course (title, subtitle, description, cover_image, price, course_type, difficulty, status, teacher_id,
                            total_duration, total_chapters, total_sections, student_count, rating_score, tags, admin_id)
        VALUES (
            'Harvard CS50x Introduction to Computer Science',
            'C、Python、SQL、Web 与计算思维，适合零基础打底',
            'CS50x is a broad intro course with lectures, notes, problem sets, labs, and final project. It is useful as the prerequisite path before algorithms and systems courses.',
            'https://cs50.harvard.edu/x/2026/favicon.ico',
            0, 0, 1, 1, v_teacher_id, 43200, 4, 4, 680, 4.8,
            '["Harvard","C语言","Python","SQL","Problem Sets","入门"]',
            v_admin_id
        )
        RETURNING id INTO v_course_id;

        INSERT INTO course_chapter (course_id, title, description, sort, admin_id)
        VALUES (v_course_id, '计算机科学导论', 'C、数组、算法、内存、数据结构。', 10, v_admin_id)
        RETURNING id INTO v_chapter_id;
        INSERT INTO course_section (course_id, chapter_id, title, description, video_url, resource_url, duration, sort, is_free, admin_id)
        VALUES
        (v_course_id, v_chapter_id, 'CS50x Course Home', '公开视频、notes、problem sets、labs。', 'https://cs50.harvard.edu/x/2026/', 'https://cs50.harvard.edu/x/2026/', 21600, 10, 1, v_admin_id);

        INSERT INTO course_chapter (course_id, title, description, sort, admin_id)
        VALUES (v_course_id, 'Python、SQL 与 Web', '把基础编程迁移到脚本、数据库和 Web 应用。', 20, v_admin_id)
        RETURNING id INTO v_chapter_id;
        INSERT INTO course_section (course_id, chapter_id, title, description, video_url, resource_url, duration, sort, is_free, admin_id)
        VALUES
        (v_course_id, v_chapter_id, 'Problem Sets and Final Project', '可拆成平台任务：提交代码、运行测试、查看讲解。', 'https://www.youtube.com/c/cs50', 'https://cs50.harvard.edu/x/2026/', 21600, 10, 1, v_admin_id);
    END IF;
END $$;
