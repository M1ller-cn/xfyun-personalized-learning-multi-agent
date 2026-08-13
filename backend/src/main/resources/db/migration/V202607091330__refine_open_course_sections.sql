DELETE FROM course_section WHERE course_id IN (2, 3, 4, 5, 6);

INSERT INTO course_section
    (course_id, chapter_id, title, description, video_url, duration, sort, is_free, resource_url, admin_id)
VALUES
    (2, 14, 'Lecture 1: Algorithmic Thinking', 'Peak finding and asymptotic thinking.', 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/resources/lecture-1-algorithmic-thinking-peak-finding/', 3000, 1, 1, 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/pages/assignments/', 1),
    (2, 14, 'Lecture 2: Models of Computation', 'RAM model, document distance and insertion sort.', 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/resources/lecture-2-models-of-computation-document-distance/', 3000, 2, 1, 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/pages/assignments/', 1),
    (2, 14, 'Sorting and Divide-and-Conquer', 'Merge sort and recurrence intuition.', 'https://www.youtube.com/playlist?list=PLUl4u3cNGP61Oq3tWYp6V_F-5jb5L2iHb', 2700, 3, 1, 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/', 1),
    (2, 15, 'Binary Trees and BST', 'Search trees and ordered data.', 'https://www.youtube.com/playlist?list=PLUl4u3cNGP61Oq3tWYp6V_F-5jb5L2iHb', 2700, 1, 1, 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/', 1),
    (2, 15, 'Hashing', 'Hash table design and collision handling.', 'https://www.youtube.com/playlist?list=PLUl4u3cNGP61Oq3tWYp6V_F-5jb5L2iHb', 2700, 2, 1, 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/', 1),
    (2, 15, 'Graphs and Shortest Paths', 'Graph representations and shortest-path problems.', 'https://www.youtube.com/playlist?list=PLUl4u3cNGP61Oq3tWYp6V_F-5jb5L2iHb', 3000, 3, 1, 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/', 1),
    (2, 15, 'Dynamic Programming', 'Subproblems, state definition and complexity.', 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/resources/lecture-videos/', 3300, 4, 1, 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/pages/assignments/', 1),

    (3, 16, 'Course Map and Calendar', 'Understand the CS 61A rhythm and weekly materials.', 'https://cs61a.org/', 1200, 1, 1, 'https://cs61a.org/', 1),
    (3, 16, 'Functions and Control', 'Python functions, expressions and control flow.', 'https://www.youtube.com/watch?v=CoHCUimLmdM', 2700, 2, 1, 'https://cs61a.org/articles/about-61a/', 1),
    (3, 16, 'Recursion', 'Recursive decomposition and environment diagrams.', 'https://www.youtube.com/watch?v=CoHCUimLmdM', 2700, 3, 1, 'https://cs61a.org/', 1),
    (3, 16, 'Projects and Labs', 'How to use labs, homework and projects for practice.', 'https://cs61a.org/', 1500, 4, 1, 'https://cs61a.org/', 1),
    (3, 17, 'Higher-Order Functions', 'Functions as values and abstraction patterns.', 'https://insideempire.github.io/CS61A-Website-Archive/', 2400, 1, 1, 'https://insideempire.github.io/CS61A-Website-Archive/', 1),
    (3, 17, 'Interpreters', 'Eval/apply model and language implementation.', 'https://insideempire.github.io/CS61A-Website-Archive/', 3000, 2, 1, 'https://insideempire.github.io/CS61A-Website-Archive/', 1),
    (3, 17, 'Exam Review', 'Review problems and common traps.', 'https://insideempire.github.io/CS61A-Website-Archive/', 1800, 3, 1, 'https://insideempire.github.io/CS61A-Website-Archive/', 1),

    (4, 18, 'Course Site and Setup', 'Set up Java tooling and course workflow.', 'https://sp25.datastructur.es/', 1200, 1, 1, 'https://sp25.datastructur.es/', 1),
    (4, 18, 'Java Objects and Interfaces', 'Object-oriented foundations for data structures.', 'https://www.youtube.com/playlist?list=PLu0nzW8Es1x3TmpwQRLMQwCtulEd43ZY8', 2700, 2, 1, 'https://sp25.datastructur.es/', 1),
    (4, 18, 'Lists, Arrays and Iteration', 'Array lists, linked lists and iteration patterns.', 'https://www.youtube.com/playlist?list=PLu0nzW8Es1x3TmpwQRLMQwCtulEd43ZY8', 2700, 3, 1, 'https://sp25.datastructur.es/', 1),
    (4, 18, 'Trees and Maps', 'Trees, maps and ordered symbol tables.', 'https://www.youtube.com/playlist?list=PLu0nzW8Es1x3TmpwQRLMQwCtulEd43ZY8', 3000, 4, 1, 'https://people.eecs.berkeley.edu/~jrs/61b/', 1),
    (4, 19, 'Homework Workflow', 'Use homework to consolidate ADT concepts.', 'https://fa23.datastructur.es/', 1500, 1, 1, 'https://fa23.datastructur.es/', 1),
    (4, 19, 'Projects Roadmap', 'Plan the project sequence and milestones.', 'https://fa23.datastructur.es/', 1800, 2, 1, 'https://fa23.datastructur.es/', 1),
    (4, 19, 'Testing and Autograding', 'Understand tests, specs and feedback loops.', 'https://fa23.datastructur.es/', 1800, 3, 1, 'https://fa23.datastructur.es/', 1),

    (5, 20, 'Project 1: Boolean Logic', 'Build elementary logic gates from NAND.', 'https://www.nand2tetris.org/course', 1800, 1, 1, 'https://www.nand2tetris.org/course', 1),
    (5, 20, 'Project 2: Boolean Arithmetic', 'Construct adders and the ALU.', 'https://www.nand2tetris.org/course', 2100, 2, 1, 'https://www.nand2tetris.org/course', 1),
    (5, 20, 'Project 3: Sequential Logic', 'Memory, registers and clocked circuits.', 'https://www.nand2tetris.org/course', 2100, 3, 1, 'https://www.nand2tetris.org/course', 1),
    (5, 20, 'Project 4: Machine Language', 'Write low-level programs on the Hack platform.', 'https://www.coursera.org/learn/build-a-computer', 2400, 4, 1, 'https://www.nand2tetris.org/course', 1),
    (5, 21, 'Project 5: Computer Architecture', 'Assemble CPU, memory and I/O into a computer.', 'https://www.youtube.com/playlist?list=PLxrmhEW0PGtW6nGXE1f-H4hFKta4p_R55', 2700, 1, 1, 'https://www.nand2tetris.org/course', 1),
    (5, 21, 'Project 6: Assembler', 'Translate symbolic Hack assembly into binary.', 'https://www.youtube.com/playlist?list=PLxrmhEW0PGtW6nGXE1f-H4hFKta4p_R55', 2700, 2, 1, 'https://www.nand2tetris.org/course', 1),
    (5, 21, 'Projects 7-12 Roadmap', 'VM, compiler and operating-system path.', 'https://www.youtube.com/playlist?list=PLxrmhEW0PGtW6nGXE1f-H4hFKta4p_R55', 3000, 3, 1, 'https://www.nand2tetris.org/course', 1),

    (6, 22, 'Week 0: Scratch and Computational Thinking', 'Build the first mental model of programs.', 'https://cs50.harvard.edu/x/2026/', 2400, 1, 1, 'https://cs50.harvard.edu/x/2026/', 1),
    (6, 22, 'Week 1: C', 'C syntax, memory and compilation basics.', 'https://cs50.harvard.edu/x/2026/', 3000, 2, 1, 'https://cs50.harvard.edu/x/2026/', 1),
    (6, 22, 'Week 2: Arrays and Algorithms', 'Arrays, strings and algorithmic thinking.', 'https://cs50.harvard.edu/x/2026/', 3000, 3, 1, 'https://cs50.harvard.edu/x/2026/', 1),
    (6, 23, 'Week 6: Python', 'Move from C to Python and compare abstractions.', 'https://cs50.harvard.edu/x/2026/', 2700, 1, 1, 'https://cs50.harvard.edu/x/2026/', 1),
    (6, 23, 'Week 7: SQL', 'Relational modeling and query practice.', 'https://cs50.harvard.edu/x/2026/', 2700, 2, 1, 'https://cs50.harvard.edu/x/2026/', 1),
    (6, 23, 'Final Project', 'Define, build and present a final project.', 'https://cs50.harvard.edu/x/2026/', 2400, 3, 1, 'https://cs50.harvard.edu/x/2026/', 1);

UPDATE course c
SET total_sections = s.section_count,
    total_duration = s.duration_sum,
    update_time = CURRENT_TIMESTAMP
FROM (
    SELECT course_id, COUNT(*)::int AS section_count, COALESCE(SUM(duration), 0)::int AS duration_sum
    FROM course_section
    WHERE is_delete = 0 AND course_id IN (2, 3, 4, 5, 6)
    GROUP BY course_id
) s
WHERE c.id = s.course_id;
