import fs from 'fs';

// Complete extracted dataset from user's indexedDB snapshot
const employees = [
  { id: "1425d3VPnVWJQspXafS5", name: "kiry Trennd2", lastName: "", role: "BODEGUERO", email: "kirytrennd@gmail.com", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", userId: "QWefsZmnxKZKslpi8PsWPCv1LEv1", createdAt: "2026-08-07T04:37:31.860Z" },
  { id: "BCujKOcWnY8IpUj3wGIQ", name: "Almacen", lastName: "Derick", role: "ambos", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", userId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2" },
  { id: "IArXkIPqQs2dkpCSEvZp", name: "Darwin", lastName: "Lema", role: "ambos", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", userId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2" },
  { id: "S74EOWLIpqK8Nfojua6I", name: "Bryan", lastName: "Santos", role: "vendedor", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", userId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2" },
  { id: "TeE6PBYUFPVgpKnUNERG", name: "Jose", lastName: "Idrovo", role: "ambos", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", userId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2" },
  { id: "Wg9Zf53b0NVxkomfxcTO", name: "Jean", lastName: "Moran", role: "vendedor", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", userId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2" },
  { id: "mklcKT63oHPDquKpcfoS", name: "Marcelo", lastName: "Gutama", role: "supervisor_cobranza", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", userId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2" }
];

const budgets = [
  { id: "0UTS4izGr4Tzas0gFXe2", month: "2026-08", salesBudget: 25000, collectionsBudget: 0, employeeId: "mklcKT63oHPDquKpcfoS", userId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2" },
  { id: "BCujKOcWnY8IpUj3wGIQ_2026-07", month: "2026-07", salesBudget: 10000, collectionsBudget: 80000, employeeId: "BCujKOcWnY8IpUj3wGIQ", userId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", updatedAt: "2026-07-10T21:03:26.588Z" },
  { id: "CrW41CfPwA4bthpiL7TJ", month: "2026-08", salesBudget: 25000, collectionsBudget: 0, employeeId: "Wg9Zf53b0NVxkomfxcTO", userId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2" },
  { id: "S74EOWLIpqK8Nfojua6I_2026-07", month: "2026-07", salesBudget: 25000, collectionsBudget: 0, employeeId: "S74EOWLIpqK8Nfojua6I", userId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", updatedAt: "2026-07-10T21:03:26.588Z" },
  { id: "Wg9Zf53b0NVxkomfxcTO_2026-07", month: "2026-07", salesBudget: 25000, collectionsBudget: 0, employeeId: "Wg9Zf53b0NVxkomfxcTO", userId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", updatedAt: "2026-07-10T21:03:26.588Z" },
  { id: "bF0iIyx8KEY8DGU3ojyO", month: "2026-08", salesBudget: 25000, collectionsBudget: 20000, employeeId: "TeE6PBYUFPVgpKnUNERG", userId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2" },
  { id: "fPsjHhPGaR3z0oe68U0T", month: "2026-08", salesBudget: 25000, collectionsBudget: 20000, employeeId: "IArXkIPqQs2dkpCSEvZp", userId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2" },
  { id: "h8UN0osNGpMEbqMNmDzj", month: "2026-08", salesBudget: 25000, collectionsBudget: 0, employeeId: "S74EOWLIpqK8Nfojua6I", userId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2" },
  { id: "hZHPgXjb2VVz0wDBJoQl_2026-07", month: "2026-07", salesBudget: 25000, collectionsBudget: 20000, employeeId: "TeE6PBYUFPVgpKnUNERG", userId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", updatedAt: "2026-07-10T21:03:26.588Z" },
  { id: "o6Msyh0gCARkOn26obXc_2026-07", month: "2026-07", salesBudget: 25000, collectionsBudget: 20000, employeeId: "IArXkIPqQs2dkpCSEvZp", userId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", updatedAt: "2026-07-10T21:03:26.588Z" },
  { id: "paHkXOsEYIICga5lOxiX", month: "2026-08", salesBudget: 25000, collectionsBudget: 80000, employeeId: "BCujKOcWnY8IpUj3wGIQ", userId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2" },
  { id: "uxtrp4dfLyJSdWfjNdQc", month: "2026-08", salesBudget: 25, collectionsBudget: 0, employeeId: "pDrsWutPIW5Dd0Cf8Jay", userId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2", enterpriseId: "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2" }
];

console.log("Employees:", employees.length, "Budgets:", budgets.length);
