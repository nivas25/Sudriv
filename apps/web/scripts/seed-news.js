const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =============================================================================
// Production-Quality News Items for Sudriv Demo
// Based on real developments: Sansad Chalo / CJP protests, NEET controversy,
// Desh Bachao Morcha farmer protests, Parliament Monsoon Session 2026
// =============================================================================

const NEWS_ITEMS = [

  // ── CRITICAL ────────────────────────────────────────────────────────────────

  {
    headline: "Police Lathicharge on Sansad Chalo Marchers Near Parliament",
    summary: "Delhi Police use tear gas and lathi charge to disperse thousands of CJP-led protesters attempting to march to Parliament demanding Education Minister's resignation.",
    content: "Breaking news from the national capital. Delhi Police have used tear gas and lathi charge to disperse thousands of protesters attempting to march towards Parliament House this afternoon.\n\n[CAMERA 1 - ANCHOR CLOSE-UP]\n\nThe march, organized under the banner of the Cockroach Janata Party and supported by several student organizations, was demanding the resignation of Union Education Minister Dharmendra Pradhan over alleged irregularities in the NEET-UG 2026 examination.\n\n[CUT TO - GROUND FOOTAGE]\n\nDespite heavy security deployment and the imposition of Section 163 of the Bharatiya Nagarik Suraksha Sanhita, thousands of demonstrators broke through the initial barricades near Jantar Mantar. Police sources confirm that nearly 180 people have been injured, including both protesters and security personnel.\n\n[CAMERA 2 - ANCHOR]\n\nCJP founder Abhijeet Dipke is among those detained during the demonstration. We have reporters on the ground and will bring you live updates as this story develops.",
    category: "protest",
    priority: "critical",
    estimated_duration_seconds: 150,
    source: "PTI",
    metadata: { location: "New Delhi", tags: ["sansad-chalo", "CJP", "police-action", "parliament"] }
  },

  {
    headline: "Sonam Wangchuk Extends Indefinite Hunger Strike After Police Crackdown",
    summary: "Climate activist Sonam Wangchuk, hospitalized at Safdarjung, vows to continue his fast until youth leaders are allowed to meet parliamentarians.",
    content: "Climate and education activist Sonam Wangchuk has announced that he will continue his indefinite hunger strike following the police crackdown on the Sansad Chalo march.\n\n[CAMERA 1 - ANCHOR]\n\nWangchuk, who was forcibly moved to Safdarjung Hospital by Delhi Police on July 18th, has described his stay at the hospital as — and I quote — an illegal detention, citing severe restrictions on his movement and communication.\n\n[GRAPHIC - WANGCHUK STATEMENT]\n\nIn a statement released through his legal team, Wangchuk has laid out two conditions for ending his fast. He will only break his hunger strike if youth leaders are allowed to meet with parliamentarians at Sansad Bhawan, or if he himself is permitted to meet with political leaders from the hospital to discuss the examination crisis.\n\n[CAMERA 2 - ANCHOR]\n\nSignificantly, the Delhi High Court has now directed that Wangchuk be shifted from Safdarjung Hospital to Medanta Hospital in Delhi, following an appeal filed by his wife, Gitanjali Angmo. We will continue to monitor his condition closely.",
    category: "protest",
    priority: "critical",
    estimated_duration_seconds: 135,
    source: "ANI",
    metadata: { location: "New Delhi", tags: ["sonam-wangchuk", "hunger-strike", "high-court"] }
  },

  {
    headline: "NEET-UG 2026: Fresh Allegations of OMR Sheet Tampering Surface",
    summary: "Student groups present evidence of alleged discrepancies in OMR sheets and scorecards from the re-examination held on June 21.",
    content: "The NEET-UG 2026 examination controversy has deepened further today with fresh allegations of OMR sheet tampering.\n\n[CAMERA 1 - ANCHOR]\n\nMultiple student organizations have come forward with what they claim is evidence of discrepancies between original OMR answer sheets and the scorecards issued after the re-examination held on June 21st. The re-examination itself was necessitated by an alleged paper leak in the original May 3rd test.\n\n[GRAPHIC - TIMELINE OF NEET CRISIS]\n\nThe National Testing Agency has categorically rejected these claims. In an official statement, the NTA has maintained that all records are consistent and that viral images of allegedly altered OMR sheets circulating on social media are fabricated.\n\n[CAMERA 2 - ANCHOR]\n\nHowever, opposition parties are not convinced. They have demanded an independent judicial inquiry and have been pressing for a full discussion in Parliament during the ongoing Monsoon Session. The matter is expected to dominate proceedings tomorrow as well.",
    category: "education",
    priority: "critical",
    estimated_duration_seconds: 120,
    source: "NDTV",
    metadata: { location: "National", tags: ["NEET", "NTA", "OMR-tampering", "education-crisis"] }
  },

  // ── HIGH ────────────────────────────────────────────────────────────────────

  {
    headline: "Parliament Monsoon Session Disrupted Over NEET Debate Demand",
    summary: "Opposition stalls both Houses demanding substantive debate on NEET irregularities; government accuses Congress of shifting goalposts.",
    content: "The Monsoon Session of Parliament, which commenced yesterday and is scheduled to run until August 13th, has faced significant disruptions on its second day.\n\n[CAMERA 1 - ANCHOR]\n\nOpposition parties led by the INDIA alliance have been actively demanding a substantive debate on the NEET-UG examination irregularities. Both Lok Sabha and Rajya Sabha were adjourned multiple times as opposition members stormed the well of the house.\n\n[CUT TO - PARLIAMENT FOOTAGE]\n\nTensions escalated this afternoon as government ministers accused Leader of Opposition Rahul Gandhi of — quote — shifting goalposts. Ministers stated that the government had agreed to a debate on NEET, but claimed the Congress party subsequently added a demand for the Union Education Minister's resignation as a precondition, further stalling the session.\n\n[CAMERA 2 - ANCHOR]\n\nThe government has a legislative agenda of 28 pending bills, including the Supreme Court Number of Judges Amendment Bill 2026. Parliamentary affairs observers say the deadlock could continue if both sides do not find a middle ground soon.",
    category: "politics",
    priority: "high",
    estimated_duration_seconds: 140,
    source: "Hindustan Times",
    metadata: { location: "New Delhi", tags: ["parliament", "monsoon-session", "opposition", "NEET-debate"] }
  },

  {
    headline: "Desh Bachao Morcha: Thousands of Farmers March Against India-US FTA",
    summary: "Farmer unions mobilize toward Delhi protesting proposed India-US Free Trade Agreement; Shambhu border heavily barricaded.",
    content: "Thousands of farmers from Punjab, Haryana, and western Uttar Pradesh have mobilized toward the national capital today under the banner of the Desh Bachao Morcha.\n\n[CAMERA 1 - ANCHOR]\n\nThe farmers are protesting against a proposed India-United States Free Trade Agreement, which they believe could flood domestic markets with cheaper subsidized American agricultural and dairy products. Farmer leaders say this would devastate the livelihoods of small and marginal farmers across the country.\n\n[CUT TO - SHAMBHU BORDER VISUALS]\n\nThe Shambhu border between Punjab and Haryana has been heavily barricaded by Haryana Police. While many farmers have been stopped at the interstate border, some have managed to reach the Kisan Ghat rally site in Delhi.\n\n[CAMERA 2 - ANCHOR]\n\nFarmer leader Sarwan Singh Pandher has demanded full transparency, stating that the government has not adequately consulted stakeholders or made the trade negotiation documents public. He has called on the government to either scrap the proposed agreement or subject it to parliamentary debate.",
    category: "protest",
    priority: "high",
    estimated_duration_seconds: 130,
    source: "The Indian Express",
    metadata: { location: "Punjab-Haryana Border", tags: ["farmers", "FTA", "desh-bachao-morcha", "SKM"] }
  },

  {
    headline: "PM Modi Addresses NDA MPs: 'Strict Action Taken on Paper Leaks'",
    summary: "Prime Minister tells party MPs that his government has acted decisively on examination irregularities and urges them to engage with youth.",
    content: "Prime Minister Narendra Modi, addressing NDA MPs at a parliamentary party meeting today, has defended his government's handling of the examination crisis.\n\n[CAMERA 1 - ANCHOR]\n\nThe Prime Minister stated that his government has taken — and I quote — strict action against those involved in paper leaks, and urged his party members to proactively engage with the youth of the country.\n\n[GRAPHIC - PM MODI QUOTE]\n\nThis statement comes against the backdrop of mounting pressure from the opposition and street protests demanding accountability from the Union Education Ministry. The Prime Minister, however, did not directly address the demand for Education Minister Dharmendra Pradhan's resignation.\n\n[CAMERA 2 - ANCHOR]\n\nPolitical analysts note that this is the first time the Prime Minister has publicly acknowledged the gravity of the examination crisis. The opposition has dismissed the statement as insufficient, with Congress spokesperson Jairam Ramesh calling it — quote — too little, too late.",
    category: "politics",
    priority: "high",
    estimated_duration_seconds: 110,
    source: "Times of India",
    metadata: { location: "New Delhi", tags: ["PM-Modi", "NDA", "paper-leak", "NEET"] }
  },

  {
    headline: "Delhi High Court Orders Wangchuk Shifted to Medanta Hospital",
    summary: "Court directs transfer of fasting activist to Medanta after wife files appeal citing inadequate medical attention at Safdarjung.",
    content: "The Delhi High Court has today directed that climate activist Sonam Wangchuk be immediately shifted from Safdarjung Hospital to Medanta Hospital in Delhi.\n\n[CAMERA 1 - ANCHOR]\n\nThe order came following an urgent appeal filed by Wangchuk's wife, Gitanjali Angmo, who argued that her husband was not receiving adequate medical attention and that his stay at Safdarjung amounted to illegal detention.\n\n[GRAPHIC - COURT ORDER DETAILS]\n\nJustice Prathiba M. Singh, while passing the order, noted that the fundamental right to health cannot be compromised. The court has also directed the Delhi Police to ensure unrestricted access for Wangchuk's family members and legal counsel.\n\n[CAMERA 2 - ANCHOR]\n\nWangchuk's medical team has reported that his condition remains stable but concerning. He has been on hunger strike for over 72 hours and medical professionals have recommended close monitoring.",
    category: "national",
    priority: "high",
    estimated_duration_seconds: 100,
    source: "LiveLaw",
    metadata: { location: "New Delhi", tags: ["delhi-HC", "sonam-wangchuk", "medanta", "court-order"] }
  },

  {
    headline: "Farmer Leaders Reach Agreement with Haryana Government at Shambhu",
    summary: "Desh Bachao Morcha suspends march after Haryana assures a meeting with Union Agriculture Minister within 10 days.",
    content: "A developing story now from the Shambhu border. The Desh Bachao Morcha leadership has reached an agreement with the Haryana government and has called off the march to Delhi.\n\n[CAMERA 1 - ANCHOR]\n\nThe Haryana government has reportedly assured the protesting farmer organizations that it will facilitate a meeting between farmer representatives and the Union Agriculture Minister within the next 10 days. Authorities have also promised to address the issue of detained farmer leaders.\n\n[CUT TO - SHAMBHU BORDER VISUALS]\n\nFollowing the announcement, farmers have begun returning home. However, Sarwan Singh Pandher made it clear that this is only a temporary suspension. He warned that if the promised meeting does not materialize or if the government proceeds with the FTA negotiations without adequate consultation, the farmers will resume their agitation with greater intensity.\n\n[CAMERA 2 - ANCHOR]\n\nThis marks the third time in recent months that farmer organizations have mobilized against the proposed trade deal, indicating growing rural unease over the government's trade policy direction.",
    category: "national",
    priority: "high",
    estimated_duration_seconds: 115,
    source: "The Tribune",
    metadata: { location: "Shambhu Border", tags: ["farmers", "haryana", "agreement", "FTA"] }
  },

  // ── MEDIUM ──────────────────────────────────────────────────────────────────

  {
    headline: "Supreme Court Amendment Bill Listed for Monsoon Session",
    summary: "Government to introduce bill to increase the number of Supreme Court judges from 34 to 40 amid rising pendency.",
    content: "The Union Law Ministry has listed the Supreme Court Number of Judges Amendment Bill 2026 for introduction during the ongoing Monsoon Session.\n\n[CAMERA 1 - ANCHOR]\n\nThe bill proposes to increase the sanctioned strength of the Supreme Court from the current 34 judges, including the Chief Justice, to 40. This comes amid growing concerns over the rising pendency of cases, which has crossed the 80,000 mark in the apex court.\n\n[GRAPHIC - SC PENDENCY DATA]\n\nChief Justice of India Sanjiv Khanna has repeatedly flagged the need for additional judges to handle the growing caseload. Legal experts have largely welcomed the move, though some have cautioned that increasing numbers alone will not address the systemic issues in judicial administration.\n\n[CAMERA 2 - ANCHOR]\n\nThe bill is expected to be taken up later this week, provided the impasse over the NEET debate is resolved.",
    category: "politics",
    priority: "medium",
    estimated_duration_seconds: 90,
    source: "Bar & Bench",
    metadata: { location: "New Delhi", tags: ["supreme-court", "judiciary", "bill", "monsoon-session"] }
  },

  {
    headline: "Student Groups Call for Nationwide Bandh on July 25",
    summary: "Over 40 student organizations announce a nationwide shutdown to press for NEET reforms and education minister's ouster.",
    content: "Over 40 student organizations across the country have jointly announced a call for a nationwide bandh on July 25th.\n\n[CAMERA 1 - ANCHOR]\n\nThe bandh call is intended to press for comprehensive reforms in the national examination system and the removal of Union Education Minister Dharmendra Pradhan. Student leaders say the protest will be peaceful but widespread, with marches planned in every state capital.\n\n[GRAPHIC - BANDH DETAILS MAP]\n\nThe coordination between these groups has been facilitated largely through social media, with the hashtag — Students Against Paper Leak — trending consistently for the past 72 hours. Several prominent universities, including JNU, Delhi University, and Hyderabad Central University, have seen significant student mobilization.\n\n[CAMERA 2 - ANCHOR]\n\nThe government has not yet responded to the bandh call. Security establishments in major cities have been put on alert as a precautionary measure.",
    category: "education",
    priority: "medium",
    estimated_duration_seconds: 95,
    source: "The Hindu",
    metadata: { location: "National", tags: ["bandh", "students", "NEET", "education-reform"] }
  },

  {
    headline: "NTA Chairman Faces Parliamentary Committee Summons",
    summary: "Standing Committee on Education summons NTA chief to explain examination process failures and paper leak timeline.",
    content: "The Parliamentary Standing Committee on Education has summoned the Chairman of the National Testing Agency for a special hearing next week.\n\n[CAMERA 1 - ANCHOR]\n\nThe committee, chaired by senior BJP MP Dr. Anil Jain, has asked the NTA chairman to appear with a comprehensive presentation on the examination process, the sequence of events leading to the paper leak, and the remedial measures undertaken since.\n\n[CAMERA 2 - ANCHOR]\n\nCommittee sources indicate that members from both ruling and opposition benches have expressed serious concerns about the credibility of the national examination system. This marks the first formal parliamentary scrutiny of the NTA since the NEET crisis erupted in May. The hearing is expected to be held behind closed doors, with a summary report to be tabled in Parliament during the current session.",
    category: "education",
    priority: "medium",
    estimated_duration_seconds: 85,
    source: "Deccan Herald",
    metadata: { location: "New Delhi", tags: ["NTA", "standing-committee", "parliament", "accountability"] }
  },

  {
    headline: "IMD Issues Red Alert for Mumbai as Heavy Rains Intensify",
    summary: "India Meteorological Department warns of extremely heavy rainfall in Mumbai and Konkan region over next 48 hours.",
    content: "The India Meteorological Department has issued a red alert for Mumbai and the Konkan region, warning of extremely heavy rainfall over the next 48 hours.\n\n[CAMERA 1 - ANCHOR]\n\nSeveral parts of Mumbai have already recorded over 150 millimeters of rainfall in the past 12 hours. The Brihanmumbai Municipal Corporation has advised citizens to avoid unnecessary travel and has activated all disaster response teams.\n\n[CUT TO - MUMBAI RAIN FOOTAGE]\n\nLocal train services on the Western and Central lines are running with delays of 15 to 20 minutes. The Mumbai-Pune Expressway has been placed on a traffic advisory due to low visibility and waterlogging near the Khandala ghat section.\n\n[CAMERA 2 - ANCHOR]\n\nThe National Disaster Response Force has pre-positioned teams in vulnerable areas across the city. Schools and colleges in Mumbai, Thane, and Raigad districts will remain closed tomorrow as a precautionary measure.",
    category: "national",
    priority: "medium",
    estimated_duration_seconds: 100,
    source: "IMD / PTI",
    metadata: { location: "Mumbai", tags: ["weather", "monsoon", "red-alert", "mumbai-rains"] }
  },

  {
    headline: "Sensex Crosses 82,000 as FII Inflows Hit Monthly High",
    summary: "Markets rally on strong Q1 earnings and renewed foreign institutional investor confidence; banking stocks lead gains.",
    content: "Turning now to markets. The BSE Sensex has crossed the 82,000 mark for the first time, powered by a strong rally in banking and IT stocks.\n\n[CAMERA 1 - ANCHOR]\n\nForeign institutional investors have pumped in over 18,000 crore rupees this month alone, the highest monthly inflow in 2026 so far. The rally is being driven by better-than-expected Q1 earnings from major banks and technology companies.\n\n[GRAPHIC - MARKET DATA]\n\nThe Nifty 50 is trading above 24,800, up nearly 1.2 percent. HDFC Bank, Infosys, and Reliance Industries are among the top gainers. However, market analysts have cautioned that global headwinds, including the US Federal Reserve's stance on interest rates and geopolitical tensions, could limit further upside in the near term.\n\n[CAMERA 2 - ANCHOR]\n\nThe rupee is trading at 84.35 against the US dollar, marginally weaker from yesterday's close.",
    category: "business",
    priority: "medium",
    estimated_duration_seconds: 85,
    source: "Bloomberg Quint",
    metadata: { location: "Mumbai", tags: ["sensex", "markets", "FII", "rally"] }
  },

  {
    headline: "ISRO Announces Chandrayaan-4 Mission Date for October 2026",
    summary: "India's space agency confirms Chandrayaan-4 lunar sample return mission launch window for October, from Sriharikota.",
    content: "India's space agency ISRO has officially announced the launch window for the ambitious Chandrayaan-4 lunar sample return mission.\n\n[CAMERA 1 - ANCHOR]\n\nISRO Chairman S. Somanath confirmed today that the Chandrayaan-4 spacecraft will be launched from the Satish Dhawan Space Centre in Sriharikota during the October 2026 window. If successful, India will become only the fourth country to return lunar samples to Earth, after the United States, the Soviet Union, and China.\n\n[GRAPHIC - CHANDRAYAAN-4 MISSION PROFILE]\n\nThe mission will involve two separate rocket launches. The first will carry the lunar lander and ascent module, while the second will deploy the Earth return capsule in lunar orbit. The two will dock autonomously around the Moon — a first for ISRO.\n\n[CAMERA 2 - ANCHOR]\n\nISRO officials say the mission hardware is in the final stages of integration and testing. This follows the historic success of Chandrayaan-3, which made India the first country to soft-land near the lunar south pole in 2023.",
    category: "science",
    priority: "medium",
    estimated_duration_seconds: 105,
    source: "ISRO / The Hindu",
    metadata: { location: "Bengaluru", tags: ["ISRO", "chandrayaan-4", "space", "moon-mission"] }
  }

];

async function seedNews() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Sudriv — Seeding Production News Items');
  console.log('═══════════════════════════════════════════════════');

  // 1. Clear existing news items
  console.log('\n→ Clearing old news items...');
  const { error: deleteError } = await supabase
    .from('news_items')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (deleteError) {
    console.error('  ✗ Error clearing news:', deleteError.message);
  } else {
    console.log('  ✓ Old news items cleared.');
  }

  // 2. Insert new items
  console.log(`\n→ Inserting ${NEWS_ITEMS.length} production news items...`);
  const { data, error: insertError } = await supabase
    .from('news_items')
    .insert(NEWS_ITEMS)
    .select();

  if (insertError) {
    console.error('  ✗ Error inserting news:', insertError.message);
  } else {
    console.log(`  ✓ Successfully inserted ${data.length} news items.`);
    console.log('\n  Breakdown:');
    const critical = data.filter(d => d.priority === 'critical').length;
    const high = data.filter(d => d.priority === 'high').length;
    const medium = data.filter(d => d.priority === 'medium').length;
    console.log(`    🔴 Critical: ${critical}`);
    console.log(`    🟠 High:     ${high}`);
    console.log(`    🟡 Medium:   ${medium}`);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Seeding Complete!');
  console.log('═══════════════════════════════════════════════════\n');
}

seedNews().catch(console.error);
