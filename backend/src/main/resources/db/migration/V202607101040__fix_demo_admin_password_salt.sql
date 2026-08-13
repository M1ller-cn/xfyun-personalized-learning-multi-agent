UPDATE "user"
SET user_password = '$2a$10$HSskfpaxut5ZZ/MS6NB9wuTfIqPVsRx/YSzBp2TNnjJdmrV06Zxdy',
    update_time = NOW()
WHERE user_account = 'admin'
  AND user_role = 'admin'
  AND is_delete = 0;
