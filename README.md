# 科大讯飞_基于大模型的个性化资源生成与学习多智能体系统开发

## 核心能力

- **动态学习画像与路径规划**：识别学习目标、薄弱知识点与学习行为，形成可调整的个性化路径。
- **课程知识库 RAG**：围绕五门计算机课程，将课程资料、知识图谱、向量检索与中文搜索结合，提供可追溯的中文辅导。
- **智能学习辅导**：检索、辅导、评测、路径规划等角色按任务协作；模型不可用时可降级为基础学习功能。
- **智能批改与代码评测**：支持客观题、主观题建议评分、代码编译与测试点反馈。
- **教师教学工作台**：课程与班级管理、作业/试卷发布、学情趋势、风险学生与题库管理。
- **AI 资源生成**：支持 PPT 生成、试卷排版、知识库资料处理等教学资源生产流程。
- **三端协同**：React Web 学生端与教师端、Flutter 移动端共享同一后端与学习数据。
- **真人数字助教（可选）**：可通过环境变量接入第三方数字人服务，未配置时不影响基础功能。

## 技术架构

| 层级 | 主要技术 |
| --- | --- |
| Web | React 19、TypeScript、Vite、Tailwind CSS |
| 移动端 | Flutter、Dart |
| 后端 | Java 21、Spring Boot、Spring Security、MyBatis Plus、LangChain4j |
| 数据与检索 | PostgreSQL + pgvector、Redis、Elasticsearch、Neo4j |
| 服务化 | Docker Compose、Gotenberg、OnlyOffice、Typst、Python PPT 服务 |

## 目录说明

```text
.
├── web/                         # React 学生端与教师端
├── backend/                     # Spring Boot API 与数据库迁移
├── app/                         # Flutter 移动端
├── docker/                      # Docker Compose 与环境变量模板
├── ppt-service/                 # PPT 生成服务
├── typst-service/               # 试卷/文档排版服务
├── rtc-service/                 # 实时音视频服务
├── scripts/                     # Windows PowerShell 启动与检查脚本
└── docs/                        # 产品与部署文档
```

## 快速启动（Windows）

### 1. 准备环境

- Docker Desktop（启用 WSL 2 / 虚拟化）
- Node.js 20+（建议 LTS）
- Docker Compose v2

可选：本地开发后端需要 JDK 21；运行移动端需要 Flutter 3.10+。

### 2. 配置环境变量

在 PowerShell 中执行：

```powershell
cd "项目根目录"
Copy-Item docker/.env.example docker/.env
Copy-Item web/.env.example web/.env.local
```

编辑 `docker/.env`，填写数据库、Redis、Neo4j、JWT 等本地配置；如需 AI 对话，填写 `DEEPSEEK_API_KEY` 并将 `DEEPSEEK_ENABLED=true`。数字人、OSS、语音等为可选配置。

### 3. 启动后端依赖与服务

```powershell
./scripts/start-full-docker.ps1
```

首次执行会下载镜像并构建服务，耗时会较长。服务就绪后，后端地址为 `http://127.0.0.1:8080`。

### 4. 启动 Web 端

另开一个 PowerShell 窗口：

```powershell
cd "项目根目录"
./scripts/start-web.ps1
```

访问：

- 学生端：`http://127.0.0.1:5174/`
- 教师端：`http://127.0.0.1:5174/login?entry=teacher`
- 教师端登录后：`http://127.0.0.1:5174/admin`

### 5. 健康检查与停止

```powershell
./scripts/check-platform-readiness.ps1
docker compose --env-file docker/.env -f docker/docker-compose.yml stop
```
