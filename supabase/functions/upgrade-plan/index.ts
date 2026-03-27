import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ── JWT auth — REQUIRED: this function modifies plan in the database ──────
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const { data: { user: authUser } } = await supabaseClient.auth.getUser(authHeader.slice(7));
    if (!authUser) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { new_plan } = await req.json();
    // Always use authenticated user — ignore body user_id to prevent privilege escalation
    const user_id = authUser.id;

    if (!new_plan || !['free', 'maker', 'pro', 'studio'].includes(new_plan)) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan. Must be: free, maker, pro, or studio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TODO: Uncomment when STRIPE_SECRET_KEY is available:
    /*
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    
    const PRICE_IDS = {
      studio: 'price_studio_monthly_id',
      scale: 'price_scale_monthly_id'
    };
    
    // Get or create Stripe customer
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user_id)
      .single();
    
    let customerId = profile?.stripe_customer_id;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email,
        metadata: { user_id }
      });
      customerId = customer.id;
      
      await supabaseClient
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user_id);
    }
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ 
        price: PRICE_IDS[new_plan as keyof typeof PRICE_IDS], 
        quantity: 1 
      }],
      mode: 'subscription',
      success_url: `${Deno.env.get('APP_URL')}/dashboard?upgraded=true`,
      cancel_url: `${Deno.env.get('APP_URL')}/pricing`
    });
    
    return new Response(
      JSON.stringify({ 
        success: true,
        checkout_url: session.url
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    */

    // MOCK: For now, just update the plan directly
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ 
        plan: new_plan,
        plan_started_at: new Date().toISOString()
      })
      .eq('id', user_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        mock_mode: true,
        message: `Plan updated to ${new_plan}. Payment integration coming soon. You'll be notified when Studio and Scale plans launch with full payment processing.`,
        new_plan
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in upgrade-plan:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
