import unittest
import os
import sys
import asyncio
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).parent))

import server
from server import (
    verify_password,
    get_password_hash,
    create_access_token,
    generate_secure_link,
    generate_2fa_secret,
    verify_2fa_code,
    UPLOAD_DIR,
    health_check,
    root
)

class TestFileDropBackend(unittest.TestCase):
    def test_health_endpoints(self):
        """Verify health and API root endpoints return healthy status"""
        res_health = asyncio.run(health_check())
        self.assertEqual(res_health, {"status": "healthy", "service": "FileDrop API"})

        res_root = asyncio.run(root())
        self.assertEqual(res_root["status"], "healthy")

    def test_password_hashing(self):
        """Verify password hashing and verification logic"""
        raw_password = "SecurePassword123!@#"
        hashed = get_password_hash(raw_password)
        self.assertNotEqual(hashed, raw_password)
        self.assertTrue(verify_password(raw_password, hashed))
        self.assertFalse(verify_password("WrongPassword!", hashed))

    def test_long_password_handling(self):
        """Verify passwords longer than 72 bytes do not crash the hashing logic"""
        long_pwd = "A" * 100
        hashed = get_password_hash(long_pwd)
        self.assertTrue(verify_password(long_pwd, hashed))

    def test_secure_link_generation(self):
        """Verify generated share links are unique and cryptographically strong"""
        link1 = generate_secure_link()
        link2 = generate_secure_link()
        self.assertGreaterEqual(len(link1), 32)
        self.assertGreaterEqual(len(link2), 32)
        self.assertNotEqual(link1, link2)

    def test_2fa_totp(self):
        """Verify TOTP secret generation and code verification"""
        secret = generate_2fa_secret()
        self.assertEqual(len(secret), 32)
        import pyotp
        totp = pyotp.TOTP(secret)
        current_code = totp.now()
        self.assertTrue(verify_2fa_code(secret, current_code))
        self.assertFalse(verify_2fa_code(secret, "000000"))

    def test_jwt_token_generation(self):
        """Verify JWT access tokens can be created and decoded"""
        from jose import jwt
        token = create_access_token({"sub": "user@example.com"}, timedelta(minutes=15))
        payload = jwt.decode(token, server.SECRET_KEY, algorithms=[server.ALGORITHM])
        self.assertEqual(payload.get("sub"), "user@example.com")
        self.assertIn("exp", payload)

    def test_upload_dir_exists(self):
        """Verify UPLOAD_DIR is located properly inside project on disk"""
        self.assertTrue(UPLOAD_DIR.exists())
        self.assertTrue(UPLOAD_DIR.is_dir())

if __name__ == "__main__":
    unittest.main()
