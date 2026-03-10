<?php
namespace MemoryMint\Helpers;

if (!defined('ABSPATH')) {
    exit;
}

class Validation {

    /**
     * Allowed file types grouped by category.
     */
    private static $allowed_types = [
        'image' => ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
        'video' => ['video/mp4', 'video/quicktime', 'video/webm'],
        'audio' => ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/x-m4a'],
    ];

    /**
     * Validate an uploaded file.
     *
     * @return array ['valid' => bool, 'error' => string|null, 'file_type' => string|null]
     */
    public static function validate_file($file) {
        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            return ['valid' => false, 'error' => 'Invalid file upload.', 'file_type' => null];
        }

        // Check MIME type
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime_type = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        $file_type = self::get_file_category($mime_type);
        if (!$file_type) {
            return [
                'valid' => false,
                'error' => 'File type not supported. Allowed: JPG, PNG, WEBP, HEIC, MP4, MOV, WEBM, MP3, M4A, WAV.',
                'file_type' => null,
            ];
        }

        // Check file size against limits
        $max_sizes = [
            'image' => intval(get_option('memorymint_max_image_size', 10485760)),
            'video' => intval(get_option('memorymint_max_video_size', 52428800)),
            'audio' => intval(get_option('memorymint_max_audio_size', 10485760)),
        ];

        $max_size = $max_sizes[$file_type] ?? 10485760;

        if ($file['size'] > $max_size) {
            $max_mb = round($max_size / 1048576);
            return [
                'valid' => false,
                'error' => "File exceeds maximum size of {$max_mb}MB for {$file_type} files.",
                'file_type' => $file_type,
            ];
        }

        return ['valid' => true, 'error' => null, 'file_type' => $file_type];
    }

    /**
     * Get the file category (image, video, audio) from MIME type.
     */
    public static function get_file_category($mime_type) {
        foreach (self::$allowed_types as $category => $types) {
            if (in_array($mime_type, $types, true)) {
                return $category;
            }
        }
        return null;
    }

    /**
     * Sanitize a keepsake title.
     */
    public static function sanitize_title($title) {
        $title = sanitize_text_field($title);
        return mb_substr($title, 0, 100);
    }

    /**
     * Sanitize a keepsake description.
     */
    public static function sanitize_description($description) {
        $description = sanitize_textarea_field($description);
        return mb_substr($description, 0, 500);
    }

    /**
     * Validate a privacy level.
     */
    public static function validate_privacy($privacy) {
        return in_array($privacy, ['public', 'shared', 'private'], true);
    }

    /**
     * Validate a Cardano wallet address (basic format check).
     */
    public static function validate_wallet_address($address) {
        // Bech32 addresses start with addr1 (mainnet) or addr_test1 (testnet)
        if (preg_match('/^addr1[a-z0-9]{50,}$/i', $address)) {
            return true;
        }
        if (preg_match('/^addr_test1[a-z0-9]{50,}$/i', $address)) {
            return true;
        }
        return false;
    }

    /**
     * Validate an email address.
     */
    public static function validate_email($email) {
        return is_email($email) !== false;
    }
}
