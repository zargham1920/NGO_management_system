// Use global fetch
async function testAll() {
  console.log('--- STARTING BACKEND API VERIFICATION TESTS ---');
  const API_BASE = 'http://localhost:3000/api';
  let token = '';

  // 1. Auth Test (Login as seeded Admin)
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@umeedrdms.org',
        password: 'Admin@1234',
        role: 'NGO Admin'
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(`Login failed: ${data.message || res.statusText}`);
    }
    token = data.data.token;
    console.log('✅ Auth Login Successful. Token acquired.');
  } catch (err) {
    console.error('❌ Auth Login Failed:', err.message);
    process.exit(1);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Helper to test an endpoint
  async function testEndpoint(name, path, method = 'GET', body = null) {
    try {
      const config = { method, headers: authHeaders };
      if (body) config.body = JSON.stringify(body);
      const res = await fetch(`${API_BASE}${path}`, config);
      const data = await res.json();
      if (res.ok && data.success) {
        console.log(`✅ ${name} : Passed`);
        return data.data || data;
      } else {
        console.error(`❌ ${name} : Failed (Status ${res.status}):`, data.message || data);
      }
    } catch (err) {
      console.error(`❌ ${name} : Error:`, err.message);
    }
  }

  // 2. Dashboard
  await testEndpoint('Dashboard Overview', '/dashboard');

  // 3. Beneficiaries CRUD
  console.log('\n--- Testing Beneficiaries API ---');
  const createdBen = await testEndpoint('Create Beneficiary', '/beneficiaries', 'POST', {
    name: 'Test Beneficiary',
    cnic: '42101-9999999-9',
    age: 29,
    household_size: 4,
    income_source: 'Laborer',
    location_id: 1,
    needs: 'Dry rations',
    status: 'approved'
  });
  if (createdBen && createdBen.beneficiary_id) {
    const benId = createdBen.beneficiary_id;
    await testEndpoint('Get Beneficiary By ID', `/beneficiaries/${benId}`);
    await testEndpoint('Update Beneficiary', `/beneficiaries/${benId}`, 'PUT', {
      name: 'Test Beneficiary Updated',
      cnic: '42101-9999999-9',
      age: 30,
      household_size: 5,
      income_source: 'Shopkeeper',
      location_id: 1,
      needs: 'Dry rations and water',
      status: 'approved'
    });
    await testEndpoint('Get All Beneficiaries (with filters)', '/beneficiaries?status=approved');
    await testEndpoint('Delete Beneficiary', `/beneficiaries/${benId}`, 'DELETE');
  }

  // 4. Donors & Donations CRUD
  console.log('\n--- Testing Donors & Donations API ---');
  const createdDonor = await testEndpoint('Create Donor', '/donors', 'POST', {
    donor_name: 'Test Donor Organization',
    contact: '0312-3456789',
    type: 'Corporate',
    email: 'test_donor_' + Date.now() + '@example.com'
  });
  if (createdDonor && createdDonor.donor_id) {
    const donorId = createdDonor.donor_id;
    await testEndpoint('Get Donor By ID', `/donors/${donorId}`);
    await testEndpoint('Update Donor', `/donors/${donorId}`, 'PUT', {
      donor_name: 'Test Donor Organization Updated',
      contact: '0312-3456789',
      type: 'Corporate',
      email: createdDonor.email
    });
    
    // Donation under this donor
    const createdDonation = await testEndpoint('Create Donation', '/donations', 'POST', {
      donor_id: donorId,
      amount: 150000,
      type: 'Cash',
      status: 'Received',
      donation_date: '2026-05-20'
    });
    if (createdDonation && createdDonation.donation_id) {
      const donationId = createdDonation.donation_id;
      await testEndpoint('Get Donations list', '/donations');
      await testEndpoint('Get Donations Stats', '/donations/stats');
      await testEndpoint('Update Donation', `/donations/${donationId}`, 'PUT', {
        donor_id: donorId,
        amount: 175000,
        type: 'Cash',
        status: 'Received',
        donation_date: '2026-05-20'
      });
      // Allocate Donation to Project 1
      await testEndpoint('Allocate Donation', `/donations/${donationId}/allocate`, 'POST', {
        project_id: 1,
        allocated_amount: 50000,
        purpose: 'Water pumps construction',
        allocation_date: '2026-05-21'
      });
      // Delete Donation
      await testEndpoint('Delete Donation', `/donations/${donationId}`, 'DELETE');
    }
    // Delete Donor
    await testEndpoint('Delete Donor', `/donors/${donorId}`, 'DELETE');
  }

  // 5. Projects
  console.log('\n--- Testing Projects API ---');
  await testEndpoint('Get Projects Summary', '/projects/summary');
  await testEndpoint('Get Projects Locations', '/projects/locations');
  const createdProj = await testEndpoint('Create Project', '/projects', 'POST', {
    project_name: 'Test Infrastructure Project',
    sector: 'Infrastructure',
    location_id: 1,
    start_date: '2026-06-01',
    end_date: '2026-12-31',
    budget: 900000,
    status: 'Active'
  });
  if (createdProj && createdProj.project_id) {
    const projId = createdProj.project_id;
    await testEndpoint('Get Project By ID', `/projects/${projId}`);
    await testEndpoint('Update Project', `/projects/${projId}`, 'PUT', {
      project_name: 'Test Infrastructure Project Updated',
      sector: 'Infrastructure',
      location_id: 1,
      start_date: '2026-06-01',
      end_date: '2026-12-31',
      budget: 950000,
      status: 'Ongoing'
    });
    await testEndpoint('Delete Project', `/projects/${projId}`, 'DELETE');
  }

  // 6. Volunteers
  console.log('\n--- Testing Volunteers API ---');
  const createdVol = await testEndpoint('Create Volunteer', '/volunteers', 'POST', {
    name: 'Test Volunteer',
    email: 'test_volunteer_' + Date.now() + '@example.com',
    phone: '0321-9876543',
    skills: 'First Aid, Logistics',
    availability: 'Available',
    address: 'Street 4, Sector G-9, Islamabad'
  });
  if (createdVol && createdVol.volunteer_id) {
    const volId = createdVol.volunteer_id;
    await testEndpoint('Get Volunteer By ID', `/volunteers/${volId}`);
    await testEndpoint('Update Volunteer', `/volunteers/${volId}`, 'PUT', {
      name: 'Test Volunteer Updated',
      email: createdVol.email,
      phone: '0321-9876543',
      skills: 'First Aid, Logistics, Translation',
      availability: 'Available',
      address: 'Street 4, Sector G-9, Islamabad'
    });
    await testEndpoint('Assign Volunteer to Project', `/volunteers/${volId}/assign`, 'POST', {
      project_id: 1,
      role_in_project: 'Coordinator',
      assigned_date: '2026-05-25'
    });
    await testEndpoint('Delete Volunteer', `/volunteers/${volId}`, 'DELETE');
  }

  // 7. Inventory
  console.log('\n--- Testing Inventory API ---');
  await testEndpoint('Get Inventory Summary', '/inventory/summary');
  await testEndpoint('Get Inventory Categories', '/inventory/categories');
  const createdItem = await testEndpoint('Create Inventory Item', '/inventory', 'POST', {
    item_name: 'Test Inventory Item',
    category: 'Water',
    quantity: 100,
    project_id: 1
  });
  if (createdItem && createdItem.item_id) {
    const itemId = createdItem.item_id;
    await testEndpoint('Get Inventory Item By ID', `/inventory/${itemId}`);
    await testEndpoint('Adjust Stock Level', `/inventory/${itemId}/adjust`, 'PATCH', {
      quantity: 80,
      reason: 'Quality control waste'
    });
    await testEndpoint('Update Inventory Item Details', `/inventory/${itemId}`, 'PUT', {
      item_name: 'Test Inventory Item Updated',
      category: 'Water',
      quantity: 80,
      project_id: 1
    });
    
    // 8. Aid Distribution
    console.log('\n--- Testing Aid Distribution API ---');
    await testEndpoint('Get Distributions Summary', '/distributions/summary');
    const createdDist = await testEndpoint('Record Aid Distribution', '/distributions', 'POST', {
      project_id: 1,
      beneficiary_id: 1,
      item_id: itemId,
      quantity_given: 10,
      notes: 'Standard distribution event',
      distribution_date: '2026-05-25'
    });
    if (createdDist && createdDist.distribution_id) {
      const distId = createdDist.distribution_id;
      await testEndpoint('Get Distribution List', '/distributions');
      await testEndpoint('Delete Distribution (Reversion test)', `/distributions/${distId}`, 'DELETE');
    }
    
    await testEndpoint('Delete Inventory Item', `/inventory/${itemId}`, 'DELETE');
  }

  // 9. Reports
  console.log('\n--- Testing Reports API ---');
  await testEndpoint('Financial Report', '/reports/financial');
  await testEndpoint('Donor Impact Report', '/reports/donor-impact');
  await testEndpoint('Beneficiaries Report', '/reports/beneficiaries');
  await testEndpoint('Inventory Report', '/reports/inventory');
  await testEndpoint('Projects Report', '/reports/projects');
  await testEndpoint('Distributions Report', '/reports/distributions');

  console.log('\n--- ALL TESTS FINISHED ---');
}

testAll();
