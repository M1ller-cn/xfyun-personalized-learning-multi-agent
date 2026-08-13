CREATE TABLE IF NOT EXISTS personalized_learning_profile (
    user_id BIGINT PRIMARY KEY,
    stage VARCHAR(256) NOT NULL,
    goal TEXT NOT NULL,
    foundation TEXT NOT NULL,
    weak_points TEXT NOT NULL,
    preference TEXT NOT NULL,
    pace TEXT NOT NULL,
    active_course_key VARCHAR(32) NOT NULL,
    conversation_summary TEXT,
    revision INTEGER NOT NULL DEFAULT 1,
    initialized SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS personalized_learning_task (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    course_key VARCHAR(32) NOT NULL,
    topic_id VARCHAR(64) NOT NULL,
    task_index INTEGER NOT NULL,
    completed SMALLINT NOT NULL DEFAULT 0,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_personalized_learning_task UNIQUE (user_id, course_key, topic_id, task_index)
);

CREATE INDEX IF NOT EXISTS idx_personalized_task_user_course
    ON personalized_learning_task (user_id, course_key);

CREATE TABLE IF NOT EXISTS personalized_learning_evaluation (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    course_key VARCHAR(32) NOT NULL,
    topic_id VARCHAR(64) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    score INTEGER NOT NULL,
    level VARCHAR(32) NOT NULL,
    feedback TEXT NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_personalized_eval_user_topic
    ON personalized_learning_evaluation (user_id, course_key, topic_id, create_time DESC);
