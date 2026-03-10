<?php
namespace MemoryMint\Api;

use MemoryMint\Helpers\Validation;

if (!defined('ABSPATH')) {
    exit;
}

class UploadApi {

    const NAMESPACE = 'memorymint/v1';

    public function register_routes() {
        register_rest_route(self::NAMESPACE, '/upload', [
            'methods' => 'POST',
            'callback' => [$this, 'upload_file'],
            'permission_callback' => [$this, 'check_auth'],
        ]);

        register_rest_route(self::NAMESPACE, '/upload/(?P<id>\d+)', [
            'methods' => 'DELETE',
            'callback' => [$this, 'delete_file'],
            'permission_callback' => [$this, 'check_auth'],
        ]);
    }

    /**
     * Handle file upload to WordPress media library.
     */
    public function upload_file(\WP_REST_Request $request) {
        $files = $request->get_file_params();

        if (empty($files['file'])) {
            return new \WP_REST_Response([
                'success' => false,
                'error' => 'No file provided.',
            ], 400);
        }

        $file = $files['file'];

        // Validate the file
        $validation = Validation::validate_file($file);
        if (!$validation['valid']) {
            return new \WP_REST_Response([
                'success' => false,
                'error' => $validation['error'],
            ], 400);
        }

        // Use WordPress media handling
        require_once ABSPATH . 'wp-admin/includes/image.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';

        // Prepare the file for WordPress upload
        $_FILES['memorymint_upload'] = $file;

        $attachment_id = media_handle_upload('memorymint_upload', 0);

        if (is_wp_error($attachment_id)) {
            return new \WP_REST_Response([
                'success' => false,
                'error' => 'Upload failed: ' . $attachment_id->get_error_message(),
            ], 500);
        }

        // Tag the attachment with our plugin meta
        $user = wp_get_current_user();
        update_post_meta($attachment_id, '_memorymint_upload', true);
        update_post_meta($attachment_id, '_memorymint_user_id', $user->ID);
        update_post_meta($attachment_id, '_memorymint_file_type', $validation['file_type']);

        $file_url = wp_get_attachment_url($attachment_id);
        $file_meta = wp_get_attachment_metadata($attachment_id);

        return new \WP_REST_Response([
            'success' => true,
            'attachment_id' => $attachment_id,
            'url' => $file_url,
            'file_type' => $validation['file_type'],
            'file_size' => $file['size'],
            'metadata' => $file_meta,
        ], 201);
    }

    /**
     * Delete an uploaded file (only if not yet minted).
     */
    public function delete_file(\WP_REST_Request $request) {
        $attachment_id = intval($request->get_param('id'));
        $user = wp_get_current_user();

        // Verify this attachment belongs to the user
        $owner = get_post_meta($attachment_id, '_memorymint_user_id', true);
        if (intval($owner) !== $user->ID) {
            return new \WP_REST_Response([
                'success' => false,
                'error' => 'You do not own this file.',
            ], 403);
        }

        // Check if attached to a minted keepsake
        global $wpdb;
        $table = $wpdb->prefix . 'memorymint_keepsakes';
        $minted = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $table WHERE file_attachment_id = %d AND mint_status = 'minted'",
            $attachment_id
        ));

        if ($minted > 0) {
            return new \WP_REST_Response([
                'success' => false,
                'error' => 'Cannot delete a file that has been minted to the blockchain.',
            ], 400);
        }

        wp_delete_attachment($attachment_id, true);

        return new \WP_REST_Response([
            'success' => true,
            'message' => 'File deleted.',
        ], 200);
    }

    public function check_auth(\WP_REST_Request $request) {
        $auth_api = new AuthApi();
        return $auth_api->check_auth($request);
    }
}
