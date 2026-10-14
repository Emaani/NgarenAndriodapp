jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { addLocalFarmer, getLocalFarmers, setLocalFarmerActive } from '../localFarmers';

describe('Add Farmer (admin) flow', () => {
  it('adds a farmer, persists it as Inactive, then activates it', async () => {
    expect(await getLocalFarmers()).toHaveLength(0);

    const added = await addLocalFarmer({
      farmerName: 'Jane Nabirye',
      farmName: 'Green Acres',
      location: 'Mbarara',
      phone: '+256700000001',
      addedBy: 'Admin',
    });

    // Starts Inactive (pending activation) with zeroed metrics.
    expect(added.status).toBe('inactive');
    expect(added.id.startsWith('lf-')).toBe(true);
    expect(added.animals).toBe(0);

    // It is read back from the store (shows up in the portfolio).
    const afterAdd = await getLocalFarmers();
    expect(afterAdd).toHaveLength(1);
    expect(afterAdd[0].farmerName).toBe('Jane Nabirye');
    expect(afterAdd[0].status).toBe('inactive');

    // Admin activates it.
    await setLocalFarmerActive(added.id, true);
    const afterActivate = await getLocalFarmers();
    expect(afterActivate[0].status).toBe('active');
  });
});
