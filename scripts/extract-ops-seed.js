const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');

function load(file, exportName) {
  let s = fs.readFileSync(file, 'utf8');
  s = s.replace(/[\s\S]*?export const /, 'const ');
  s = s.replace(/const (\w+):[^=]+=/, 'const $1 =');
  s = s.replace(/ as unknown as Record<string, OpsScreenDef>;\s*$/, ';');
  return new Function(`${s}\nreturn ${exportName};`)();
}

const screens = load(
  path.join(root, 'selorg-admin-dashboard/src/modules/ops/data/screens.generated.ts'),
  'GENERATED_SCREENS',
);
const forms = load(
  path.join(root, 'selorg-admin-dashboard/src/modules/ops/data/actionForms.generated.ts'),
  'GENERATED_ACTION_FORMS',
);

const badge = (label, tone) => ({ label, tone });
const slim = {};
for (const [id, sc] of Object.entries(screens)) {
  slim[id] = {
    id,
    title: sc.title,
    entity: sc.entity,
    cap: sc.cap,
    tabs: sc.tabs,
    columns: sc.columns,
    flow: sc.flow,
    flowAt: sc.flowAt ?? null,
    kpis: sc.kpis,
    actions: sc.actions,
    rows: sc.rows,
  };
}

slim['bulk-dispatch'] = {
  id: 'bulk-dispatch',
  title: 'Load Planning',
  entity: 'Load plan',
  cap: 'cu',
  tabs: ["Today's loads", 'Assigned', 'Completed'],
  columns: ['Load plan', 'Vehicle', 'Driver', 'Origin', 'Destination', 'Bags', 'Weight', 'Status'],
  flow: ['Load planned', 'Vehicle matched', 'Driver assigned', 'Loading', 'Dispatched', 'Delivered'].map((label) => ({
    label,
    actor: 'Dispatch',
  })),
  flowAt: 2,
  kpis: [
    { value: '5', label: 'Loads today' },
    { value: '3', label: 'Assigned' },
    { value: '1', label: 'In progress' },
    { value: '42', label: 'Bags to load' },
    { value: '3', label: 'Vehicles' },
    { value: '96%', label: 'On time' },
  ],
  actions: ['Match vehicle', 'Assign driver', 'Split into trips', 'Dispatch load'],
  rows: {
    "Today's loads": [
      ['LP-2210', 'KA-05-AB-1122', 'Raju Naik', 'WH-01 Bommasandra', 'Zomato Hyperpure, BTM', '18', '480 kg', badge('In progress', 'amber')],
      ['LP-2211', 'KA-05-AC-4488', 'Suresh Gowda', 'DS-02 Koramangala', 'FreshMenu, Marathahalli', '12', '310 kg', badge('Assigned', 'blue')],
      ['LP-2212', 'KA-01-AK-7710', 'Ravi Shankar', 'WH-01 Bommasandra', 'Swiggy Stores, Indiranagar', '22', '620 kg', badge('Loading', 'amber')],
      ['LP-2213', 'KA-05-AB-1122', 'Raju Naik', 'WH-01 Bommasandra', 'Rebel Foods, Koramangala', '8', '190 kg', badge('Scheduled', 'grey')],
    ],
    Assigned: [
      ['LP-2211', 'KA-05-AC-4488', 'Suresh Gowda', 'DS-02 Koramangala', 'FreshMenu, Marathahalli', '12', '310 kg', badge('Assigned', 'blue')],
      ['LP-2212', 'KA-01-AK-7710', 'Ravi Shankar', 'WH-01 Bommasandra', 'Swiggy Stores, Indiranagar', '22', '620 kg', badge('Loading', 'amber')],
      ['LP-2213', 'KA-05-AB-1122', 'Raju Naik', 'WH-01 Bommasandra', 'Rebel Foods, Koramangala', '8', '190 kg', badge('Assigned', 'blue')],
    ],
    Completed: [
      ['LP-2209', 'KA-05-AB-1122', 'Raju Naik', 'WH-01 Bommasandra', 'BigBasket Pro, Whitefield', '24', '680 kg', badge('Delivered', 'green')],
      ['LP-2208', 'KA-05-AC-4488', 'Suresh Gowda', 'DS-01 Indiranagar', 'Metro Cash & Carry, Yeshwanthpur', '16', '420 kg', badge('Delivered', 'green')],
      ['LP-2207', 'KA-01-AK-7710', 'Ravi Shankar', 'WH-01 Bommasandra', 'Licious B2B, Whitefield', '10', '240 kg', badge('Delivered', 'green')],
    ],
  },
};

slim['bulk-track'] = {
  id: 'bulk-track',
  title: 'Consignment Tracking',
  entity: 'Consignment',
  cap: 'u',
  tabs: ['Active', 'In transit', 'Delivered', 'Exceptions'],
  columns: ['Consignment', 'Client', 'Origin', 'Destination', 'Vehicle', 'Dispatched', 'ETA', 'Status'],
  flow: ['Scheduled', 'Loading', 'In transit', 'Out for delivery', 'Delivered', 'Confirmed by client'].map((label) => ({
    label,
    actor: 'Dispatch',
  })),
  flowAt: 2,
  kpis: [
    { value: '8', label: 'Active consignments' },
    { value: '3', label: 'In transit' },
    { value: '2', label: 'Out for delivery' },
    { value: '1', label: 'Delayed' },
    { value: '2', label: 'Delivered today' },
    { value: '98%', label: 'On time' },
  ],
  actions: ['Track live', 'Call operator', 'Notify customer', 'Mark delivered', 'Close trip'],
  rows: {
    Active: [
      ['CON-8810', 'Zomato Hyperpure', 'WH-01 Bommasandra', 'BTM Layout', 'KA-05-AB-1122', '09:30', '11:00', badge('In transit', 'blue')],
      ['CON-8811', 'FreshMenu Kitchens', 'DS-02 Koramangala', 'Marathahalli', 'KA-05-AC-4488', '10:15', '11:30', badge('Out for delivery', 'amber')],
      ['CON-8812', 'Swiggy Stores', 'WH-01 Bommasandra', 'Indiranagar', 'KA-01-AK-7710', '10:45', '12:00', badge('Loading', 'amber')],
      ['CON-8813', 'Rebel Foods', 'DS-03 HSR Layout', 'Koramangala', 'KA-05-AB-9910', '—', '14:00', badge('Scheduled', 'grey')],
    ],
    'In transit': [
      ['CON-8810', 'Zomato Hyperpure', 'WH-01 Bommasandra', 'BTM Layout', 'KA-05-AB-1122', '09:30', '11:00', badge('On track', 'blue')],
      ['CON-8809', 'Metro Cash & Carry', 'WH-01 Bommasandra', 'Yeshwanthpur', 'KA-01-AK-7710', '08:00', '10:30', badge('Delayed', 'red')],
      ['CON-8808', 'BigBasket Pro', 'DS-04 Whitefield', 'Whitefield KIADB', 'KA-05-AC-4488', '09:00', '10:45', badge('On track', 'blue')],
    ],
    Delivered: [
      ['CON-8806', 'Licious B2B', 'WH-01 Bommasandra', 'Whitefield', 'KA-05-AB-1122', '07:00', '09:00', badge('Delivered', 'green')],
      ['CON-8807', 'FreshMenu Kitchens', 'DS-01 Indiranagar', 'Jayanagar', 'KA-05-AC-4488', '07:30', '09:15', badge('Delivered', 'green')],
    ],
    Exceptions: [
      ['CON-8809', 'Metro Cash & Carry', 'WH-01 Bommasandra', 'Yeshwanthpur', 'KA-01-AK-7710', '08:00', '10:30', badge('Delayed 40 min', 'red')],
      ['CON-8805', 'Rebel Foods', 'DS-02 Koramangala', 'Koramangala', 'KA-05-AB-9910', '06:30', '08:00', badge('Partial delivery', 'amber')],
    ],
  },
};

const outDir = path.join(__dirname, '../src/modules/delivery-stalls/data');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'screens.json'), JSON.stringify(slim));
fs.writeFileSync(path.join(outDir, 'action-forms.json'), JSON.stringify(forms));
console.log(
  Object.keys(slim).length,
  'screens',
  Object.keys(forms).length,
  'forms',
  fs.statSync(path.join(outDir, 'screens.json')).size,
  fs.statSync(path.join(outDir, 'action-forms.json')).size,
);
