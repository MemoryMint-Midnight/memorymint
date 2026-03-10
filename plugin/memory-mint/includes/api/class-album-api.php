<?php
namespace MemoryMint\Api;

if (!defined('ABSPATH')) {
    exit;
}

class AlbumApi {

    const NAMESPACE = 'memorymint/v1';

    public function register_routes() {
        register_rest_route(self::NAMESPACE, '/albums', [
            [
                'methods'             => 'GET',
                'callback'            => [$this, 'list_albums'],
                'permission_callback' => [$this, 'check_auth'],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [$this, 'create_album'],
                'permission_callback' => [$this, 'check_auth'],
                'args'                => [
                    'name' => ['required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
                ],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/albums/(?P<id>\d+)', [
            [
                'methods'             => 'PUT',
                'callback'            => [$this, 'rename_album'],
                'permission_callback' => [$this, 'check_auth'],
                'args'                => [
                    'name' => ['required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
                ],
            ],
            [
                'methods'             => 'DELETE',
                'callback'            => [$this, 'delete_album'],
                'permission_callback' => [$this, 'check_auth'],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/albums/(?P<id>\d+)/keepsakes', [
            'methods'             => 'POST',
            'callback'            => [$this, 'add_keepsakes'],
            'permission_callback' => [$this, 'check_auth'],
            'args'                => [
                'keepsake_ids' => ['required' => true, 'type' => 'array'],
            ],
        ]);

        register_rest_route(self::NAMESPACE, '/albums/(?P<id>\d+)/keepsakes/(?P<keepsake_id>\d+)', [
            'methods'             => 'DELETE',
            'callback'            => [$this, 'remove_keepsake'],
            'permission_callback' => [$this, 'check_auth'],
        ]);
    }

    /**
     * Bearer token auth — same pattern as MintApi.
     */
    public function check_auth(\WP_REST_Request $request) {
        $header = $request->get_header('Authorization');
        if (!$header || strpos($header, 'Bearer ') !== 0) {
            return false;
        }
        $encoded = substr($header, 7);
        $decoded = base64_decode($encoded);
        if (!$decoded || strpos($decoded, ':') === false) {
            return false;
        }
        [$user_id, $token] = explode(':', $decoded, 2);
        $user = get_user_by('id', intval($user_id));
        if (!$user) {
            return false;
        }
        $stored_hash = get_user_meta($user->ID, 'memorymint_auth_token', true);
        if (!$stored_hash || !wp_check_password($token, $stored_hash)) {
            return false;
        }
        wp_set_current_user($user->ID);
        return true;
    }

    /**
     * GET /albums — list the authenticated user's albums with keepsake IDs.
     */
    public function list_albums(\WP_REST_Request $request) {
        global $wpdb;
        $user         = wp_get_current_user();
        $albums_table = $wpdb->prefix . 'memorymint_albums';
        $pivot_table  = $wpdb->prefix . 'memorymint_album_keepsakes';

        $albums = $wpdb->get_results($wpdb->prepare(
            "SELECT id, name, created_at FROM $albums_table WHERE user_id = %d ORDER BY created_at ASC",
            $user->ID
        ));

        $result = [];
        foreach ($albums as $album) {
            $keepsake_ids = $wpdb->get_col($wpdb->prepare(
                "SELECT keepsake_id FROM $pivot_table WHERE album_id = %d ORDER BY added_at ASC",
                $album->id
            ));
            $result[] = [
                'id'             => intval($album->id),
                'name'           => $album->name,
                'keepsake_ids'   => array_map('intval', $keepsake_ids),
                'keepsake_count' => count($keepsake_ids),
                'created_at'     => $album->created_at,
            ];
        }

        return new \WP_REST_Response(['success' => true, 'albums' => $result], 200);
    }

    /**
     * POST /albums — create a new album.
     */
    public function create_album(\WP_REST_Request $request) {
        global $wpdb;
        $user  = wp_get_current_user();
        $name  = trim($request->get_param('name'));

        if (empty($name)) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Album name is required.'], 400);
        }

        $table = $wpdb->prefix . 'memorymint_albums';
        $wpdb->insert($table, [
            'user_id'    => $user->ID,
            'name'       => $name,
            'created_at' => current_time('mysql'),
        ]);
        $id = intval($wpdb->insert_id);

        return new \WP_REST_Response([
            'success' => true,
            'album'   => [
                'id'             => $id,
                'name'           => $name,
                'keepsake_ids'   => [],
                'keepsake_count' => 0,
                'created_at'     => current_time('mysql'),
            ],
        ], 201);
    }

    /**
     * PUT /albums/{id} — rename an album.
     */
    public function rename_album(\WP_REST_Request $request) {
        global $wpdb;
        $user     = wp_get_current_user();
        $album_id = intval($request->get_param('id'));
        $name     = trim($request->get_param('name'));

        if (empty($name)) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Album name is required.'], 400);
        }

        $table = $wpdb->prefix . 'memorymint_albums';
        $album = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $table WHERE id = %d AND user_id = %d",
            $album_id, $user->ID
        ));
        if (!$album) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Album not found.'], 404);
        }

        $wpdb->update($table, ['name' => $name], ['id' => $album_id]);
        return new \WP_REST_Response(['success' => true], 200);
    }

    /**
     * DELETE /albums/{id} — delete an album and its keepsake memberships.
     * Keepsakes themselves are NOT deleted.
     */
    public function delete_album(\WP_REST_Request $request) {
        global $wpdb;
        $user     = wp_get_current_user();
        $album_id = intval($request->get_param('id'));
        $table    = $wpdb->prefix . 'memorymint_albums';

        $album = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $table WHERE id = %d AND user_id = %d",
            $album_id, $user->ID
        ));
        if (!$album) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Album not found.'], 404);
        }

        $wpdb->delete($wpdb->prefix . 'memorymint_album_keepsakes', ['album_id' => $album_id]);
        $wpdb->delete($table, ['id' => $album_id]);

        return new \WP_REST_Response(['success' => true], 200);
    }

    /**
     * POST /albums/{id}/keepsakes — add one or more keepsakes to an album.
     * Body: { keepsake_ids: [1, 2, 3] }
     */
    public function add_keepsakes(\WP_REST_Request $request) {
        global $wpdb;
        $user         = wp_get_current_user();
        $album_id     = intval($request->get_param('id'));
        $keepsake_ids = array_map('intval', (array) $request->get_param('keepsake_ids'));

        $albums_table    = $wpdb->prefix . 'memorymint_albums';
        $keepsakes_table = $wpdb->prefix . 'memorymint_keepsakes';
        $pivot_table     = $wpdb->prefix . 'memorymint_album_keepsakes';

        $album = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $albums_table WHERE id = %d AND user_id = %d",
            $album_id, $user->ID
        ));
        if (!$album) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Album not found.'], 404);
        }

        $added = 0;
        foreach ($keepsake_ids as $keepsake_id) {
            // Ensure the keepsake belongs to this user before adding
            $owns = $wpdb->get_var($wpdb->prepare(
                "SELECT id FROM $keepsakes_table WHERE id = %d AND user_id = %d",
                $keepsake_id, $user->ID
            ));
            if (!$owns) continue;

            // UNIQUE KEY on (album_id, keepsake_id) — use INSERT IGNORE for idempotency
            $wpdb->query($wpdb->prepare(
                "INSERT IGNORE INTO $pivot_table (album_id, keepsake_id, added_at) VALUES (%d, %d, %s)",
                $album_id, $keepsake_id, current_time('mysql')
            ));
            $added++;
        }

        return new \WP_REST_Response(['success' => true, 'added' => $added], 200);
    }

    /**
     * DELETE /albums/{id}/keepsakes/{keepsake_id} — remove a keepsake from an album.
     */
    public function remove_keepsake(\WP_REST_Request $request) {
        global $wpdb;
        $user        = wp_get_current_user();
        $album_id    = intval($request->get_param('id'));
        $keepsake_id = intval($request->get_param('keepsake_id'));

        $albums_table = $wpdb->prefix . 'memorymint_albums';
        $album = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $albums_table WHERE id = %d AND user_id = %d",
            $album_id, $user->ID
        ));
        if (!$album) {
            return new \WP_REST_Response(['success' => false, 'error' => 'Album not found.'], 404);
        }

        $wpdb->delete($wpdb->prefix . 'memorymint_album_keepsakes', [
            'album_id'    => $album_id,
            'keepsake_id' => $keepsake_id,
        ]);

        return new \WP_REST_Response(['success' => true], 200);
    }
}
