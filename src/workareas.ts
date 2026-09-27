/* Broad areas of work, for people whose job title is unusual or doesn't match anything.
   Each area points at ISCO group codes (to favour matching jobs) and a few ESCO occupations whose skills stand in for the area. */
export interface WorkArea { id: string; label: string; g: string[]; jobs: string[] }

export const AREAS: WorkArea[] = [
  { id: 'marketing', label: 'Marketing and comms', g: ['1222', '2431', '2432', '2642', '3332'], jobs: ['marketing manager', 'public relations manager', 'web content manager'] },
  { id: 'sales', label: 'Sales and business development', g: ['1221', '2433', '3322', '52'], jobs: ['sales manager', 'sales account manager'] },
  { id: 'customer', label: 'Customer service and success', g: ['42', '1221'], jobs: ['customer experience manager', 'client relations manager', 'contact centre supervisor'] },
  { id: 'finance', label: 'Finance and accounting', g: ['1211', '241', '331'], jobs: ['financial manager', 'accountant', 'investment manager'] },
  { id: 'people', label: 'HR and recruitment', g: ['1212', '2423', '3333'], jobs: ['human resources manager', 'recruitment consultant'] },
  { id: 'ops', label: 'Operations and admin', g: ['1219', '334', '41', '44'], jobs: ['office manager', 'executive assistant', 'project manager'] },
  { id: 'leadership', label: 'Management and strategy', g: ['11', '12', '2421'], jobs: ['chief executive officer', 'business consultant', 'business analyst'] },
  { id: 'product', label: 'Product and projects', g: ['1219', '1223', '2421'], jobs: ['product manager', 'project manager', 'ICT project manager'] },
  { id: 'software', label: 'Software and IT', g: ['25', '35', '133'], jobs: ['software developer', 'web developer', 'ICT operations manager'] },
  { id: 'data', label: 'Data and analytics', g: ['2511', '2120', '2521'], jobs: ['data analyst', 'data scientist', 'ICT business analyst'] },
  { id: 'security', label: 'Cybersecurity', g: ['2529'], jobs: ['ICT security manager'] },
  { id: 'design', label: 'Design and creative', g: ['216', '265', '343', '264'], jobs: ['graphic designer', 'user interface designer', 'photographer'] },
  { id: 'legal', label: 'Legal and compliance', g: ['261', '342'], jobs: ['lawyer', 'policy officer'] },
  { id: 'health', label: 'Healthcare', g: ['22', '32'], jobs: ['nurse responsible for general care', 'general practitioner', 'physiotherapist', 'pharmacist'] },
  { id: 'education', label: 'Education and training', g: ['23'], jobs: ['primary school teacher', 'secondary school teacher', 'higher education lecturer', 'early years teacher'] },
  { id: 'science', label: 'Science and research', g: ['21', '31'], jobs: ['biologist', 'chemist', 'environmental scientist'] },
  { id: 'engineering', label: 'Engineering and manufacturing', g: ['214', '215', '31', '72', '81', '82'], jobs: ['mechanical engineer', 'electrical engineer', 'environmental engineer'] },
  { id: 'construction', label: 'Construction and property', g: ['1323', '2161', '71', '3334'], jobs: ['construction manager', 'architect', 'real estate agent'] },
  { id: 'trades', label: 'Skilled trades', g: ['71', '74', '72'], jobs: ['electrician', 'plumber', 'carpenter'] },
  { id: 'retail', label: 'Retail and hospitality', g: ['14', '51', '52', '94'], jobs: ['shop manager', 'restaurant manager', 'chef'] },
  { id: 'logistics', label: 'Logistics and supply chain', g: ['1324', '432', '83'], jobs: ['supply chain manager', 'warehouse manager', 'purchasing manager'] },
  { id: 'public', label: 'Public sector and policy', g: ['1213', '2422', '54'], jobs: ['policy manager', 'policy officer', 'police officer'] },
  { id: 'care', label: 'Social care and charity', g: ['2635', '53', '3412', '2432'], jobs: ['social worker', 'care at home worker', 'fundraising manager'] },
  { id: 'media', label: 'Media, arts and entertainment', g: ['264', '265', '3435'], jobs: ['journalist', 'musician', 'actor/actress'] },
  { id: 'land', label: 'Farming and environment', g: ['6', '92', '2133'], jobs: ['farm manager', 'agricultural technician', 'ecologist'] },
];
export const areaById = new Map(AREAS.map(a => [a.id, a]));
