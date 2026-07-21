const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seed() {
  console.log('Seeding Database...');

  // 1. Create MVP User
  console.log('Creating User...');
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'producer@sudriv.demo',
    password: 'sudriv-demo-2025',
    email_confirm: true,
  });

  if (authError && authError.message !== 'User already registered') {
    console.error('Error creating auth user:', authError.message);
  } else {
    console.log('Auth User created or already exists.');
  }

  // Find the user ID from the auth table
  const { data: users, error: usersError } = await supabase.from('users').select('id, email').eq('email', 'producer@sudriv.demo').single();
  let userId;
  if (!users) {
    // We need to insert into the public users table since the trigger might not exist
    const userRes = await supabase.from('users').insert({
      email: 'producer@sudriv.demo',
      display_name: 'A. Producer',
      role: 'producer'
    }).select().single();
    if (userRes.error) {
        console.error('Error inserting into public.users:', userRes.error);
    } else {
        userId = userRes.data.id;
    }
  } else {
    userId = users.id;
  }
  
  // 2. Clear old data
  await supabase.from('timelines_library').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('news_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 3. Insert Timeline Templates
  console.log('Inserting Timeline Templates...');
  const { error: timelinesError } = await supabase.from('timelines_library').insert([
    {
      name: 'Evening Prime News',
      description: 'Standard 30-minute evening broadcast with 12 segments.',
      default_duration_seconds: 1800,
      category: 'general',
      default_segments: [
        {
          position: 1,
          title: "Cold Open & Headlines",
          slug: "cold-open",
          segment_type: "headlines",
          duration_seconds: 90,
          teleprompter_text: "Good evening, I'm Alex. Tonight, we begin with breaking developments downtown where thousands have gathered.\n\n[CAMERA 2 - WIDE SHOT]\n\nThe situation is escalating rapidly as local authorities attempt to clear the main square ahead of the 9 PM curfew. We have reporters on the ground bringing you the very latest."
        },
        {
          position: 2,
          title: "Downtown Protest",
          slug: "downtown-protest",
          segment_type: "package",
          duration_seconds: 180,
          teleprompter_text: "Our correspondent is live at the scene."
        },
        {
          position: 3,
          title: "Election Update",
          slug: "election-update",
          segment_type: "live",
          duration_seconds: 120,
          teleprompter_text: "In election news today..."
        },
        {
          position: 4,
          title: "Commercial Break 1",
          slug: "break-1",
          segment_type: "break",
          duration_seconds: 180,
          teleprompter_text: "We will be right back after this."
        }
      ]
    },
    {
      name: 'Breaking News Special',
      description: 'Fast-paced rolling coverage template.',
      default_duration_seconds: 3600,
      category: 'breaking',
      default_segments: []
    },
    {
      name: 'Morning Roundup',
      description: 'Light morning mix with lifestyle and weather.',
      default_duration_seconds: 1800,
      category: 'general',
      default_segments: []
    }
  ]);

  if (timelinesError) console.error('Error inserting timelines:', timelinesError);

  // 4. Insert News Items
  console.log('Inserting News Items...');
  const { error: newsError } = await supabase.from('news_items').insert([
    {
      headline: "Earthquake hits Gujarat",
      summary: "A 5.6 magnitude earthquake hit Gujarat early morning.",
      content: "Breaking news coming in from Gujarat where a massive 5.6 magnitude earthquake has been reported. Tremors were felt as far as Mumbai.",
      category: "breaking",
      priority: "critical",
      estimated_duration_seconds: 120,
      source: "PTI"
    },
    {
      headline: "Sensex crosses 80k",
      summary: "Stock markets hit a new all-time high today.",
      content: "In financial news, the Sensex has crossed the historic 80,000 mark for the first time ever.",
      category: "business",
      priority: "high",
      estimated_duration_seconds: 90,
      source: "Reuters"
    }
  ]);
  
  if (newsError) console.error('Error inserting news:', newsError);

  console.log('Seeding Complete!');
}

seed().catch(console.error);
