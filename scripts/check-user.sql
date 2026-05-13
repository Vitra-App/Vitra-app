SELECT id, email, SUBSTRING("passwordHash", 1, 30) as hash_prefix FROM "User" LIMIT 5;
