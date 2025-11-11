import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      await logSecurityEvent(supabaseClient, null, 'invite_staff_no_auth', {
        ip: req.headers.get('x-forwarded-for') || 'unknown'
      });
      
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user's JWT and get their user ID
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('Invalid token:', userError);
      await logSecurityEvent(supabaseClient, null, 'invite_staff_invalid_token', {
        error: userError?.message,
        ip: req.headers.get('x-forwarded-for') || 'unknown'
      });
      
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if the user has staff or admin role
    const { data: hasPermission } = await supabaseClient.rpc('can_invite_staff', {
      _user_id: user.id
    });

    if (!hasPermission) {
      console.error('User lacks permission:', user.id);
      await logSecurityEvent(supabaseClient, user.id, 'invite_staff_privilege_escalation_attempt', {
        attempted_by: user.email,
        ip: req.headers.get('x-forwarded-for') || 'unknown'
      });
      
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only staff and admin can invite staff members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get request body
    const { email, password, name, role } = await req.json();

    // Validate role
    if (!['staff', 'admin'].includes(role)) {
      await logSecurityEvent(supabaseClient, user.id, 'invite_staff_invalid_role', {
        attempted_role: role,
        attempted_by: user.email
      });
      
      return new Response(
        JSON.stringify({ error: 'Invalid role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If attempting to create admin, verify the caller is admin
    if (role === 'admin') {
      const { data: isAdmin } = await supabaseClient.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });

      if (!isAdmin) {
        console.error('Non-admin attempting to create admin:', user.id);
        await logSecurityEvent(supabaseClient, user.id, 'invite_admin_escalation_attempt', {
          attempted_by: user.email,
          target_email: email,
          ip: req.headers.get('x-forwarded-for') || 'unknown'
        });
        
        return new Response(
          JSON.stringify({ error: 'Forbidden: Only admins can create admin accounts' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create the new user account
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (createError || !newUser.user) {
      console.error('Error creating user:', createError);
      await logSecurityEvent(supabaseClient, user.id, 'invite_staff_creation_failed', {
        error: createError?.message,
        target_email: email
      });
      
      return new Response(
        JSON.stringify({ error: createError?.message || 'Failed to create user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Assign the role to the new user
    const { error: roleError } = await supabaseClient
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role: role
      });

    if (roleError) {
      console.error('Error assigning role:', roleError);
      await logSecurityEvent(supabaseClient, user.id, 'invite_staff_role_assignment_failed', {
        error: roleError.message,
        target_email: email,
        target_user_id: newUser.user.id
      });
      
      return new Response(
        JSON.stringify({ error: 'User created but role assignment failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful staff creation
    await logSecurityEvent(supabaseClient, user.id, 'invite_staff_success', {
      created_by: user.email,
      target_email: email,
      target_user_id: newUser.user.id,
      role: role
    });

    console.log('Successfully created staff member:', email);

    return new Response(
      JSON.stringify({ 
        success: true,
        user: { id: newUser.user.id, email: newUser.user.email }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function logSecurityEvent(
  supabaseClient: any,
  userId: string | null,
  action: string,
  details: any
) {
  try {
    await supabaseClient.from('security_audit_log').insert({
      user_id: userId,
      action,
      details,
      ip_address: details.ip || null
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}
