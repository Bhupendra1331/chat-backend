CREATE DATABASE IF NOT EXISTS chat_backend;

USE chat_backend;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS chats (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_a_id BIGINT UNSIGNED NOT NULL,
    user_b_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT fk_chats_user_a
        FOREIGN KEY (user_a_id) REFERENCES users(id),

    CONSTRAINT fk_chats_user_b
        FOREIGN KEY (user_b_id) REFERENCES users(id),

    CONSTRAINT unique_one_to_one_chat
        UNIQUE (user_a_id, user_b_id),

    CONSTRAINT different_chat_users
        CHECK (user_a_id < user_b_id)
);

CREATE TABLE IF NOT EXISTS chat_members (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    chat_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT fk_members_chat
        FOREIGN KEY (chat_id) REFERENCES chats(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_members_user
        FOREIGN KEY (user_id) REFERENCES users(id),

    CONSTRAINT unique_chat_member
        UNIQUE (chat_id, user_id)
);

-- Test users
INSERT IGNORE INTO users (id, name, email)
VALUES
    (1, 'Rahul', 'rahul@example.com'),
    (2, 'Amit', 'amit@example.com'),
    (3, 'Priya', 'priya@example.com');