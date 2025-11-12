import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Setting up demo accounts...');

    // Create admin account
    const adminEmail = 'admin@example.com';
    const { data: existingAdmin } = await supabaseClient.auth.admin.listUsers();
    const adminExists = existingAdmin?.users.some(u => u.email === adminEmail);

    if (!adminExists) {
      const { data: adminUser, error: adminError } = await supabaseClient.auth.admin.createUser({
        email: adminEmail,
        password: 'admin123',
        email_confirm: true,
        user_metadata: { name: 'Admin User' }
      });

      if (adminError) {
        console.error('Error creating admin:', adminError);
        throw adminError;
      }

      // Assign admin role
      const { error: adminRoleError } = await supabaseClient
        .from('user_roles')
        .insert({ user_id: adminUser.user.id, role: 'admin' });

      if (adminRoleError) {
        console.error('Error assigning admin role:', adminRoleError);
        throw adminRoleError;
      }

      console.log('Admin account created successfully');
    } else {
      console.log('Admin account already exists');
    }

    // Create staff account
    const staffEmail = 'staff@example.com';
    const staffExists = existingAdmin?.users.some(u => u.email === staffEmail);

    if (!staffExists) {
      const { data: staffUser, error: staffError } = await supabaseClient.auth.admin.createUser({
        email: staffEmail,
        password: 'staff123',
        email_confirm: true,
        user_metadata: { name: 'Staff User' }
      });

      if (staffError) {
        console.error('Error creating staff:', staffError);
        throw staffError;
      }

      // Assign staff role
      const { error: staffRoleError } = await supabaseClient
        .from('user_roles')
        .insert({ user_id: staffUser.user.id, role: 'staff' });

      if (staffRoleError) {
        console.error('Error assigning staff role:', staffRoleError);
        throw staffRoleError;
      }

      console.log('Staff account created successfully');
    } else {
      console.log('Staff account already exists');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Demo accounts setup completed',
        accounts: {
          admin: { email: adminEmail, password: 'admin123' },
          staff: { email: staffEmail, password: 'staff123' }
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in setup-demo-accounts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});