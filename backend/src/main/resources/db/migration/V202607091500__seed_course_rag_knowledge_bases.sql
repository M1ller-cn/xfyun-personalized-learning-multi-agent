DO $$
DECLARE
    v_creator BIGINT;
BEGIN
    SELECT id INTO v_creator
    FROM "user"
    WHERE is_delete = 0
    ORDER BY CASE WHEN user_role IN ('admin', 'teacher') THEN 0 ELSE 1 END, id
    LIMIT 1;

    IF v_creator IS NULL THEN
        v_creator := 1;
    END IF;

    UPDATE ai_assistant
    SET model_name = 'deepseek/deepseek-chat',
        status = 'PUBLISHED',
        is_public = 1,
        system_prompt = '你是星图智课平台中的智能学习导师，底层由 DeepSeek 驱动，但回答时不要强调模型名称。你的工作不是单纯聊天，而是像一个有经验的课程助教一样，基于平台五门公开课程知识库帮助学生学习：MIT 6.006 算法设计、UC Berkeley CS61A、UC Berkeley CS61B、Nand2Tetris、Harvard CS50x。回答要自然、友好、有耐心；先判断学生的问题属于哪门课和哪个知识点，再给出清晰解释、易错提醒、练习建议和下一步学习路径。若知识库资料不足，可以补充通用计算机知识，但要说明哪些是基于课程资料，哪些是补充说明。遇到代码或算法问题时，优先用小例子、边界条件、复杂度和调试思路讲清楚。遇到学生目标模糊时，要主动追问是否保留已有学习方向，不要直接覆盖画像。',
        opening_message = '你好，我是你的智云学习导师。你可以直接问我 CS50 的 C 语言、Nand2Tetris 的计算机系统、CS61A 的 Python/SICP、CS61B 的数据结构，或者 MIT 6.006 的算法题。我会尽量按“概念解释 -> 例子 -> 易错点 -> 练习建议”的方式陪你过一遍。',
        update_time = NOW()
    WHERE id = 1;
END $$;

CREATE OR REPLACE FUNCTION seed_course_kb(
    p_name TEXT,
    p_description TEXT,
    p_doc_name TEXT,
    p_creator BIGINT,
    p_chunks TEXT[]
) RETURNS VOID AS $$
DECLARE
    v_kb_id BIGINT;
    v_doc_id BIGINT;
    v_chunk TEXT;
    v_idx INT := 0;
BEGIN
    UPDATE knowledge_base
    SET is_delete = 1, update_time = NOW()
    WHERE name = p_name AND is_delete = 0;

    INSERT INTO knowledge_base (
        name, description, embedding_model, embedding_dimension, chunk_size, chunk_overlap,
        document_count, chunk_count, status, creator_id, chunk_strategy, retrieval_mode,
        enable_query_rewrite, use_dynamic_top_k, default_top_k, create_time, update_time, is_delete
    )
    VALUES (
        p_name, p_description, 'local-course-seed', 1536, 500, 50,
        1, array_length(p_chunks, 1), 'ACTIVE', p_creator, 'COURSE_MODULE', 'HYBRID',
        false, true, 6, NOW(), NOW(), 0
    )
    RETURNING id INTO v_kb_id;

    INSERT INTO knowledge_document (
        knowledge_base_id, name, file_type, file_url, file_size, content, content_hash,
        chunk_count, status, creator_id, create_time, update_time, is_delete
    )
    VALUES (
        v_kb_id, p_doc_name, 'COURSE_SEED', 'local://course-knowledge/' || replace(lower(p_doc_name), ' ', '-'),
        length(array_to_string(p_chunks, E'\n\n')), array_to_string(p_chunks, E'\n\n'),
        md5(array_to_string(p_chunks, E'\n\n')), array_length(p_chunks, 1), 'COMPLETED',
        p_creator, NOW(), NOW(), 0
    )
    RETURNING id INTO v_doc_id;

    FOREACH v_chunk IN ARRAY p_chunks LOOP
        INSERT INTO knowledge_chunk (
            knowledge_base_id, document_id, content, chunk_index, section_title, embedding,
            metadata, create_time, is_delete
        )
        VALUES (
            v_kb_id, v_doc_id, v_chunk, v_idx,
            split_part(v_chunk, E'\n', 1),
            (array_fill(0.001::real, ARRAY[1536]))::vector,
            jsonb_build_object('documentName', p_doc_name, 'courseKnowledge', true, 'source', 'local-seed'),
            NOW(), 0
        );
        v_idx := v_idx + 1;
    END LOOP;

    INSERT INTO ai_assistant_knowledge (assistant_id, knowledge_base_id, create_time)
    VALUES (1, v_kb_id, NOW())
    ON CONFLICT (assistant_id, knowledge_base_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    v_creator BIGINT;
BEGIN
    SELECT id INTO v_creator
    FROM "user"
    WHERE is_delete = 0
    ORDER BY CASE WHEN user_role IN ('admin', 'teacher') THEN 0 ELSE 1 END, id
    LIMIT 1;

    IF v_creator IS NULL THEN
        v_creator := 1;
    END IF;

    PERFORM seed_course_kb(
        '课程知识库 - MIT 6.006 算法设计',
        'MIT 6.006 Introduction to Algorithms 的本地 RAG 知识库，覆盖算法分析、数据结构、图算法、动态规划和题目训练。',
        'MIT 6.006 算法设计课程知识卡片',
        v_creator,
        ARRAY[
            'MIT 6.006 / 算法分析基础
主题：渐近复杂度、循环不变量、递归关系、主定理、均摊分析。学习目标是能判断一个算法在最坏情况、平均情况和摊还意义下的时间与空间成本。常见易错点：只看代码行数而忽略嵌套循环的真实次数；把 O、Theta、Omega 混用；递归树每层代价没有累加到叶子层。',
            'MIT 6.006 / 排序与选择
主题：插入排序、归并排序、堆排序、快速排序、线性时间选择。需要掌握稳定性、原地性、比较排序下界、分治递推。练习建议：给定数组手推 merge sort；解释 quicksort 最坏情况为什么退化；比较 heap sort 与 merge sort 在内存和稳定性上的差异。',
            'MIT 6.006 / 数据结构支撑算法
主题：哈希表、动态数组、链表、栈队列、二叉堆、平衡二叉搜索树。核心问题是根据操作集合选择结构：查找多用哈希或树，频繁取最值用堆，维护有序性用 BST。易错点：哈希冲突、负载因子、树高和复杂度之间的关系。',
            'MIT 6.006 / 图算法
主题：BFS、DFS、拓扑排序、Dijkstra、Bellman-Ford、最短路径、最小生成树。判断题型时先看边权：无权图用 BFS；非负权用 Dijkstra；存在负权边考虑 Bellman-Ford。DFS 可用于连通性、环检测、拓扑序和强连通分量。',
            'MIT 6.006 / 动态规划
主题：最优子结构、重叠子问题、状态设计、转移方程、边界条件、填表顺序。常见模型包括背包、最长公共子序列、最短编辑距离、区间 DP。答题时建议写出：状态含义、转移、初始化、遍历顺序、复杂度。',
            'MIT 6.006 / 复习与刷题方法
算法题不要只背模板，要记录错因：状态定义错、边界漏、复杂度超、数据结构选错、证明不完整。一个章节通过的标准：能口述算法思想，能手算小例子，能写出伪代码，能解释复杂度，并能指出至少两个边界用例。'
        ]
    );

    PERFORM seed_course_kb(
        '课程知识库 - UC Berkeley CS61A Python SICP',
        'UC Berkeley CS61A 的本地 RAG 知识库，覆盖 Python、递归、高阶函数、抽象、解释器与项目训练。',
        'CS61A Python 与 SICP 课程知识卡片',
        v_creator,
        ARRAY[
            'CS61A / Python 函数与环境模型
主题：表达式求值、函数调用、局部/全局环境、名称绑定、闭包。学习目标是能画出 environment diagram，解释变量为什么引用某个值。易错点：把函数定义时的环境和调用时的环境混在一起。',
            'CS61A / 递归与树递归
主题：base case、recursive case、树递归、递归展开、递归到迭代的转换。答题时先明确子问题规模如何缩小，再写停止条件。典型问题包括阶乘、斐波那契、数字拆分、路径计数和组合搜索。',
            'CS61A / 高阶函数与抽象
主题：函数作为参数、函数作为返回值、lambda、decorator、抽象屏障。学习重点是用函数表达变化的部分。易错点：返回函数时多加括号导致提前调用；lambda 捕获变量后在循环中行为不符合预期。',
            'CS61A / 数据抽象与面向对象
主题：抽象数据类型、构造器/选择器、类、对象、继承、特殊方法。判断一个设计好不好，要看使用者是否不需要知道内部表示。练习：用 ADT 表示有理数、树、链表，再改内部结构但保持外部接口不变。',
            'CS61A / 解释器与程序语言思想
主题：Scheme、表达式解析、eval/apply、环境链、宏和解释器项目。核心是理解程序也是数据，解释器不断在环境中求值表达式。学生常卡在递归解释 AST 和环境扩展这两步。',
            'CS61A / 学习路径建议
先做 Python 基础和递归，再做高阶函数，然后进入抽象数据、树/链表、OOP，最后挑战 Scheme/解释器项目。每个阶段至少完成一次代码追踪、一次小项目、一次错题复盘。'
        ]
    );

    PERFORM seed_course_kb(
        '课程知识库 - UC Berkeley CS61B 数据结构',
        'UC Berkeley CS61B 的本地 RAG 知识库，覆盖 Java、测试、链表、树、哈希、堆、图和工程项目。',
        'CS61B 数据结构课程知识卡片',
        v_creator,
        ARRAY[
            'CS61B / Java 与测试驱动
主题：类、接口、继承、泛型、异常、JUnit、调试器。学习目标是能把数据结构写成可测试模块。易错点：== 与 equals 混用；泛型数组创建；修改集合时迭代器失效。',
            'CS61B / 链表、数组表与摊还分析
主题：Singly/Double Linked List、ArrayList、扩容、摊还 O(1)、哨兵节点。链表适合局部插入删除，数组表适合随机访问。常见 bug：空链表、单节点、头尾指针更新不一致。',
            'CS61B / 树、BST 与平衡树
主题：二叉树、二叉搜索树、遍历、递归性质、B 树、红黑树。BST 中序遍历有序，因为左子树所有键小于根，右子树所有键大于根。易错点：删除有两个孩子的节点时 successor/predecessor 替换逻辑。',
            'CS61B / 哈希表与优先队列
主题：hashCode、equals、冲突解决、拉链法、线性探测、负载因子、堆、优先队列。哈希表平均 O(1) 依赖分布和扩容；堆适合频繁取最小/最大，但不适合快速查任意元素。',
            'CS61B / 图与算法工程
主题：图表示、BFS、DFS、最短路、最小生成树、A*、并查集。工程答题要区分抽象 API 和具体实现。图题先判断图是否有向、是否带权、是否有负权、是否需要路径恢复。',
            'CS61B / 项目训练与自动评测
课程项目强调从规格说明到测试再到实现。写代码前先列 invariants 和边界用例；提交前本地跑单元测试、随机测试和压力测试。错题复盘要记录输入、期望、实际、定位过程和修复原因。'
        ]
    );

    PERFORM seed_course_kb(
        '课程知识库 - Nand2Tetris 计算机系统',
        'Nand2Tetris 的本地 RAG 知识库，覆盖布尔逻辑、计算机组成、机器语言、汇编器、虚拟机、编译器和操作系统。',
        'Nand2Tetris 计算机系统课程知识卡片',
        v_creator,
        ARRAY[
            'Nand2Tetris / 布尔逻辑与基础芯片
主题：NAND 门、Not、And、Or、Mux、DMux、Xor、多路选择器。课程思想是从一个 NAND 门构造整个计算机。易错点：只记电路图，不理解真值表；多位总线和单比特信号混淆。',
            'Nand2Tetris / 布尔算术与 ALU
主题：半加器、全加器、加法器、补码、递增器、ALU 控制位。需要理解二进制补码如何表示负数，以及 ALU 如何通过 zx/nx/zy/ny/f/no 控制输出。调试时先用小位宽手算。',
            'Nand2Tetris / 时序逻辑与内存
主题：DFF、Register、RAM、Program Counter。组合逻辑没有记忆，时序逻辑依赖时钟和状态。常见误区：把当前周期输入和下一周期输出混在一起；PC 的 reset/load/inc 优先级写错。',
            'Nand2Tetris / Hack 机器语言与计算机组成
主题：A 指令、C 指令、CPU、Memory、Computer。A 寄存器既可表示常数也可表示地址；C 指令控制 dest/comp/jump。理解取指、译码、执行循环后，汇编程序和硬件模块就能连起来。',
            'Nand2Tetris / 汇编器、VM 与编译器
主题：符号表、两遍扫描、VM 栈机、Jack 语言、语法分析、代码生成。实现汇编器时第一遍记录 label，第二遍翻译变量和指令。VM 项目重点是 call/return 栈帧和指针段映射。',
            'Nand2Tetris / 项目制学习路线
建议按硬件部分、机器语言、软件工具链、编译器四段推进。每完成一章要能解释输入输出接口、核心不变量、测试脚本为什么通过。遇到失败时优先看 HDL 引脚名、总线宽度和时序优先级。'
        ]
    );

    PERFORM seed_course_kb(
        '课程知识库 - Harvard CS50x C语言与计算机科学导论',
        'Harvard CS50x 的本地 RAG 知识库，覆盖 C、内存、算法、数据结构、Python、SQL、Web 和 problem sets。',
        'CS50x C语言与计算机科学导论课程知识卡片',
        v_creator,
        ARRAY[
            'CS50x / C 语言基础
主题：变量、类型、条件、循环、函数、数组、字符串、命令行参数。学习目标是能把自然语言步骤转成 C 程序。易错点：数组越界、char 与 string 混淆、scanf 输入格式不匹配。',
            'CS50x / 指针与内存
主题：地址、指针、malloc/free、栈与堆、valgrind、字符串底层表示。指针题先问三个问题：指向哪里、生命周期多久、谁负责释放。常见 bug：野指针、内存泄漏、double free、忘记给字符串结尾留空间。',
            'CS50x / 算法与数据结构入门
主题：线性搜索、二分搜索、排序、递归、链表、哈希表、Trie。复杂度要联系输入规模 n。二分搜索要求有序；哈希表依赖好的哈希函数；链表插入删除容易错在指针连接顺序。',
            'CS50x / Python、SQL 与 Web 基础
主题：Python 语法、Flask、HTML/CSS/JavaScript、SQL 查询、数据库设计。重点是从 C 的底层细节过渡到更高层抽象。SQL 题先写出表关系，再决定 SELECT、JOIN、WHERE、GROUP BY。',
            'CS50x / Problem Set 方法
CS50 题目通常从规格说明出发。建议先写伪代码，再处理输入校验，再实现核心逻辑，最后做边界测试。提交前检查：编译警告、格式、内存泄漏、极端输入、空输入和重复输入。',
            'CS50x / 期末项目与学习画像
如果学生目标是期末或项目，优先安排高频错点：数组/指针/内存、排序搜索、链表哈希、SQL 查询、Web 表单。每个主题都可以拆成讲解、样例、练习、自动批改和错题复盘。'
        ]
    );
END $$;

DROP FUNCTION seed_course_kb(TEXT, TEXT, TEXT, BIGINT, TEXT[]);
