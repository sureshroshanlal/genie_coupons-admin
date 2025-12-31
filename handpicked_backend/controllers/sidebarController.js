import { supabase } from '../dbhelper/dbclient.js';

export const getSidebarMenu = async (req, res) => {
  try {
    console.log('inside getsidebarMenu controller');
    const roleId = req.user?.role_id; // from JWT via protect middleware

    if (!roleId) {
      return res.status(400).json({ message: 'Missing role_id in token' });
    }

    // 1️⃣ Fetch sidebar menu for this role
    const { data: roleMenu, error: roleMenuError } = await supabase
      .from('role_menu')
      .select('menu_id')
      .eq('role_id', roleId);

    if (roleMenuError) throw roleMenuError;

    const menuIds = roleMenu.map(rm => rm.menu_id);

    // 2️⃣ Fetch sidebar items
    const { data: menus, error: menuError } = await supabase
      .from('sidebar_menu')
      .select('*')
      .in('id', menuIds)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (menuError) throw menuError;

    // 3️⃣ Build tree structure
    const menuMap = {};
    const rootMenus = [];

    menus.forEach(item => {
      menuMap[item.id] = { ...item, children: [] };
    });

    menus.forEach(item => {
      if (item.parent_id) {
        menuMap[item.parent_id]?.children.push(menuMap[item.id]);
      } else {
        rootMenus.push(menuMap[item.id]);
      }
    });

    res.json(rootMenus);
  } catch (err) {
    console.error('Sidebar fetch error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};