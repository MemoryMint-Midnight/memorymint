<?php
namespace MemoryMint\Helpers;

if (!defined('ABSPATH')) {
    exit;
}

class Encryption {

    private static $cipher = 'aes-256-cbc';

    /**
     * Derive encryption key from WordPress salts.
     */
    private static function derive_key() {
        $salt = defined('AUTH_KEY') ? AUTH_KEY : 'memorymint-fallback-key';
        $salt .= defined('SECURE_AUTH_SALT') ? SECURE_AUTH_SALT : 'memorymint-fallback-salt';
        return hash('sha256', $salt, true);
    }

    /**
     * Encrypt a string value.
     */
    public static function encrypt($plaintext) {
        $key = self::derive_key();
        $iv_length = openssl_cipher_iv_length(self::$cipher);
        $iv = openssl_random_pseudo_bytes($iv_length);

        $ciphertext = openssl_encrypt($plaintext, self::$cipher, $key, OPENSSL_RAW_DATA, $iv);

        if ($ciphertext === false) {
            return false;
        }

        return base64_encode($iv . $ciphertext);
    }

    /**
     * Decrypt an encrypted value.
     */
    public static function decrypt($encrypted) {
        $key = self::derive_key();
        $data = base64_decode($encrypted);

        if ($data === false) {
            return false;
        }

        $iv_length = openssl_cipher_iv_length(self::$cipher);
        $iv = substr($data, 0, $iv_length);
        $ciphertext = substr($data, $iv_length);

        $plaintext = openssl_decrypt($ciphertext, self::$cipher, $key, OPENSSL_RAW_DATA, $iv);

        return $plaintext;
    }
}
