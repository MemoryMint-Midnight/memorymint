<?php
if (!defined('ABSPATH')) {
    exit;
}

global $wpdb;

$page_num = isset($_GET['paged']) ? max(1, intval($_GET['paged'])) : 1;
$per_page = 25;
$offset   = ($page_num - 1) * $per_page;
$search   = isset($_GET['s']) ? sanitize_text_field($_GET['s']) : '';
$filter   = isset($_GET['filter']) ? sanitize_text_field($_GET['filter']) : '';

// ---- Build user query -----------------------------------------------------
$where    = '1=1';
$params   = [];

if ($search) {
    $where  .= ' AND (u.user_email LIKE %s OR u.display_name LIKE %s)';
    $like    = '%' . $wpdb->esc_like($search) . '%';
    $params[] = $like;
    $params[] = $like;
}

// Wallet meta join for filtering
$wallet_join = "LEFT JOIN {$wpdb->usermeta} wm ON u.ID = wm.user_id AND wm.meta_key = 'memorymint_wallet_address'";

if ($filter === 'wallet_provisioned') {
    $where .= ' AND wm.meta_value IS NOT NULL AND wm.meta_value != ""';
} elseif ($filter === 'no_wallet') {
    $where .= ' AND (wm.meta_value IS NULL OR wm.meta_value = "")';
}

// Auth method meta join
$auth_join = "LEFT JOIN {$wpdb->usermeta} am ON u.ID = am.user_id AND am.meta_key = 'memorymint_auth_method'";

// Only show users that have logged in via Memory Mint
$where .= ' AND (am.meta_value = "email" OR am.meta_value = "wallet")';

// Total count
$total_query = "SELECT COUNT(DISTINCT u.ID) FROM {$wpdb->users} u $wallet_join $auth_join WHERE $where";
$total = $params
    ? $wpdb->get_var($wpdb->prepare($total_query, ...$params))
    : $wpdb->get_var($total_query);

// Main query
$main_query = "SELECT DISTINCT
        u.ID,
        u.user_email,
        u.display_name,
        u.user_registered,
        wm.meta_value AS wallet_address,
        am.meta_value AS auth_method
    FROM {$wpdb->users} u
    $wallet_join
    $auth_join
    WHERE $where
    ORDER BY u.user_registered DESC
    LIMIT %d OFFSET %d";

$users = $params
    ? $wpdb->get_results($wpdb->prepare($main_query, array_merge($params, [$per_page, $offset])))
    : $wpdb->get_results($wpdb->prepare($main_query, $per_page, $offset));

$total_pages = max(1, ceil($total / $per_page));

// ---- Keepsake counts -------------------------------------------------------
$keepsake_table = $wpdb->prefix . 'memorymint_keepsakes';
$keepsake_counts = [];
if ($users) {
    $ids = implode(',', array_map('intval', array_column((array) $users, 'ID')));
    $rows = $wpdb->get_results("SELECT user_id, COUNT(*) AS cnt, SUM(mint_status = 'minted') AS minted_cnt FROM $keepsake_table WHERE user_id IN ($ids) GROUP BY user_id");
    foreach ($rows as $row) {
        $keepsake_counts[$row->user_id] = [
            'total'  => intval($row->cnt),
            'minted' => intval($row->minted_cnt),
        ];
    }
}

// Summary stats
$email_total  = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->usermeta} WHERE meta_key = 'memorymint_auth_method' AND meta_value = 'email'");
$wallet_total = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->usermeta} WHERE meta_key = 'memorymint_auth_method' AND meta_value = 'wallet'");
$provisioned  = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->usermeta} WHERE meta_key = 'memorymint_is_custodial'");
?>

<div class="wrap">
<h1 class="wp-heading-inline">Memory Mint — Users</h1>
<hr class="wp-header-end">

<!-- Summary cards -->
<div style="display:flex; gap:16px; margin:20px 0; flex-wrap:wrap;">
    <div style="background:#fff; border:1px solid #ddd; border-radius:6px; padding:16px 24px; min-width:160px; text-align:center;">
        <div style="font-size:28px; font-weight:700; color:#333;"><?php echo intval($email_total) + intval($wallet_total); ?></div>
        <div style="color:#777; font-size:13px;">Total MM Users</div>
    </div>
    <div style="background:#fff; border:1px solid #ddd; border-radius:6px; padding:16px 24px; min-width:160px; text-align:center;">
        <div style="font-size:28px; font-weight:700; color:#0073aa;"><?php echo intval($email_total); ?></div>
        <div style="color:#777; font-size:13px;">Email Users</div>
    </div>
    <div style="background:#fff; border:1px solid #ddd; border-radius:6px; padding:16px 24px; min-width:160px; text-align:center;">
        <div style="font-size:28px; font-weight:700; color:#00a32a;"><?php echo intval($provisioned); ?></div>
        <div style="color:#777; font-size:13px;">Custodial Wallets Provisioned</div>
    </div>
    <div style="background:#fff; border:1px solid #ddd; border-radius:6px; padding:16px 24px; min-width:160px; text-align:center;">
        <div style="font-size:28px; font-weight:700; color:#8a3ffc;"><?php echo intval($wallet_total); ?></div>
        <div style="color:#777; font-size:13px;">Wallet Users</div>
    </div>
</div>

<!-- Search + filter form -->
<form method="get" style="display:flex; gap:8px; margin-bottom:16px; align-items:center; flex-wrap:wrap;">
    <input type="hidden" name="page" value="memory-mint-users">
    <input
        type="text"
        name="s"
        value="<?php echo esc_attr($search); ?>"
        placeholder="Search by email or name…"
        style="width:260px;"
        class="regular-text">
    <select name="filter" class="regular-text">
        <option value="" <?php selected($filter, ''); ?>>All Users</option>
        <option value="wallet_provisioned" <?php selected($filter, 'wallet_provisioned'); ?>>Wallet Provisioned</option>
        <option value="no_wallet" <?php selected($filter, 'no_wallet'); ?>>No Wallet Yet</option>
    </select>
    <?php submit_button('Search', 'secondary', '', false); ?>
    <?php if ($search || $filter): ?>
        <a href="<?php echo admin_url('admin.php?page=memory-mint-users'); ?>" class="button">Clear</a>
    <?php endif; ?>
</form>

<p style="color:#777;">
    Showing <?php echo count($users); ?> of <?php echo intval($total); ?> users
    <?php if ($search): ?>&nbsp;for "<strong><?php echo esc_html($search); ?></strong>"<?php endif; ?>
</p>

<table class="widefat fixed striped" cellspacing="0">
    <thead>
        <tr>
            <th style="width:60px;">ID</th>
            <th>Email</th>
            <th style="width:90px;">Auth</th>
            <th>Wallet Address</th>
            <th style="width:90px;">Custodial</th>
            <th style="width:80px;">Keepsakes</th>
            <th style="width:80px;">Minted</th>
            <th style="width:130px;">Registered</th>
        </tr>
    </thead>
    <tbody>
    <?php if ($users): ?>
        <?php foreach ($users as $u): ?>
            <?php
            $has_custodial = (bool) get_user_meta($u->ID, 'memorymint_is_custodial', true);
            $last_login    = get_user_meta($u->ID, 'memorymint_last_login', true);
            $kc            = $keepsake_counts[$u->ID] ?? ['total' => 0, 'minted' => 0];
            $wallet_short  = $u->wallet_address
                ? substr($u->wallet_address, 0, 14) . '…' . substr($u->wallet_address, -8)
                : '—';
            $auth_badge_color = $u->auth_method === 'email' ? '#0073aa' : '#8a3ffc';
            ?>
            <tr>
                <td><?php echo intval($u->ID); ?></td>
                <td>
                    <a href="<?php echo get_edit_user_link($u->ID); ?>" title="Edit user">
                        <?php echo esc_html($u->user_email); ?>
                    </a>
                    <?php if ($last_login): ?>
                        <br><small style="color:#999;">Last login: <?php echo esc_html(human_time_diff(strtotime($last_login)) . ' ago'); ?></small>
                    <?php endif; ?>
                </td>
                <td>
                    <span style="background:<?php echo $auth_badge_color; ?>; color:#fff; padding:2px 8px; border-radius:4px; font-size:11px; white-space:nowrap;">
                        <?php echo esc_html(strtoupper($u->auth_method ?? 'unknown')); ?>
                    </span>
                </td>
                <td>
                    <small style="font-family:monospace;" title="<?php echo esc_attr($u->wallet_address); ?>">
                        <?php echo esc_html($wallet_short); ?>
                    </small>
                </td>
                <td style="text-align:center;">
                    <?php if ($has_custodial): ?>
                        <span style="color:#00a32a; font-weight:600;">&#10003; Yes</span>
                    <?php elseif ($u->auth_method === 'email'): ?>
                        <span style="color:#d63638;">&#10007; No</span>
                    <?php else: ?>
                        <span style="color:#999;">N/A</span>
                    <?php endif; ?>
                </td>
                <td style="text-align:center;"><?php echo intval($kc['total']); ?></td>
                <td style="text-align:center;"><?php echo intval($kc['minted']); ?></td>
                <td style="white-space:nowrap;">
                    <small><?php echo esc_html(date_i18n('Y-m-d', strtotime($u->user_registered))); ?></small>
                </td>
            </tr>
        <?php endforeach; ?>
    <?php else: ?>
        <tr>
            <td colspan="8" style="text-align:center; padding:40px; color:#777;">
                No Memory Mint users found<?php echo $search ? ' matching your search.' : '.'; ?>
            </td>
        </tr>
    <?php endif; ?>
    </tbody>
</table>

<!-- Pagination -->
<?php if ($total_pages > 1): ?>
    <div class="tablenav bottom" style="margin-top:12px;">
        <div class="tablenav-pages" style="float:none; text-align:center;">
            <?php
            $base_url = admin_url('admin.php?page=memory-mint-users');
            if ($search)  $base_url .= '&s=' . urlencode($search);
            if ($filter)  $base_url .= '&filter=' . urlencode($filter);

            if ($page_num > 1): ?>
                <a class="button" href="<?php echo esc_url($base_url . '&paged=' . ($page_num - 1)); ?>">&#8592; Prev</a>
            <?php endif;

            echo '&nbsp;<span style="line-height:28px;">Page ' . $page_num . ' of ' . $total_pages . '</span>&nbsp;';

            if ($page_num < $total_pages): ?>
                <a class="button" href="<?php echo esc_url($base_url . '&paged=' . ($page_num + 1)); ?>">Next &#8594;</a>
            <?php endif; ?>
        </div>
    </div>
<?php endif; ?>
</div>
