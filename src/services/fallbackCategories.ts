// Fallback categories list matching MSTC categories structure
// Generated from seed_categories.sql. Used when database table is empty.

import type { AuctionCategory } from '../types/database.types';

export const FALLBACK_CATEGORIES: AuctionCategory[] = [
  {
    "id": "c0d405ef-6d98-486b-b311-2dba7426f94d",
    "name": "Agricultural Produce",
    "parent_id": null
  },
  {
    "id": "b167d1f4-eb43-4486-a1a4-9fc592260ad3",
    "name": "Cereals",
    "parent_id": "c0d405ef-6d98-486b-b311-2dba7426f94d"
  },
  {
    "id": "1506225b-c272-4849-a2d6-5bb5e8108a83",
    "name": "Maize",
    "parent_id": "b167d1f4-eb43-4486-a1a4-9fc592260ad3"
  },
  {
    "id": "f45f3eb6-3c96-4f58-b199-f766e323b3ea",
    "name": "Barley",
    "parent_id": "b167d1f4-eb43-4486-a1a4-9fc592260ad3"
  },
  {
    "id": "82aa7aad-4b40-480f-bab2-4e92e9c79d10",
    "name": "Bajra",
    "parent_id": "b167d1f4-eb43-4486-a1a4-9fc592260ad3"
  },
  {
    "id": "77c233da-c140-45cc-b0f4-bb9a0ee22bb4",
    "name": "Ragi",
    "parent_id": "b167d1f4-eb43-4486-a1a4-9fc592260ad3"
  },
  {
    "id": "ae73d460-d7bb-4ba8-94f3-dd2545f3f25a",
    "name": "Jowar",
    "parent_id": "b167d1f4-eb43-4486-a1a4-9fc592260ad3"
  },
  {
    "id": "f6bd20c4-6779-4b30-b722-e36649c0ac97",
    "name": "Paddy",
    "parent_id": "b167d1f4-eb43-4486-a1a4-9fc592260ad3"
  },
  {
    "id": "d90c0e0e-7628-4852-b074-ae841b8458ce",
    "name": "Wheat",
    "parent_id": "b167d1f4-eb43-4486-a1a4-9fc592260ad3"
  },
  {
    "id": "ce0b7c64-9141-444c-bd19-bf2ac436ce59",
    "name": "Pulses",
    "parent_id": "c0d405ef-6d98-486b-b311-2dba7426f94d"
  },
  {
    "id": "4bcc14c0-5ae0-44f8-af37-67348ed56dcc",
    "name": "Gram/Chickpea",
    "parent_id": "ce0b7c64-9141-444c-bd19-bf2ac436ce59"
  },
  {
    "id": "520b32b9-4ccc-4157-92c9-916fffcf55ef",
    "name": "Moong Dal /Green gram",
    "parent_id": "ce0b7c64-9141-444c-bd19-bf2ac436ce59"
  },
  {
    "id": "823ec2c1-c503-4db5-b233-8ee3f5cae47b",
    "name": "Toor Dal/ Arhar Dal",
    "parent_id": "ce0b7c64-9141-444c-bd19-bf2ac436ce59"
  },
  {
    "id": "538d6f27-8a31-41fb-ac99-89d4eb81f8eb",
    "name": "Urad / Black Gram",
    "parent_id": "ce0b7c64-9141-444c-bd19-bf2ac436ce59"
  },
  {
    "id": "87b092b3-b276-4f25-876e-18126ccca0d3",
    "name": "Oil seeds/oil",
    "parent_id": "c0d405ef-6d98-486b-b311-2dba7426f94d"
  },
  {
    "id": "0995205d-6909-470b-af08-9064d8811e34",
    "name": "Mustard Seed",
    "parent_id": "87b092b3-b276-4f25-876e-18126ccca0d3"
  },
  {
    "id": "bd62f92a-9aa0-424c-af55-f7a52a43bbc8",
    "name": "Ground Nut",
    "parent_id": "87b092b3-b276-4f25-876e-18126ccca0d3"
  },
  {
    "id": "804eaaa1-cae9-4f43-bd69-e7e1fa60fc69",
    "name": "Sesamum Seed",
    "parent_id": "87b092b3-b276-4f25-876e-18126ccca0d3"
  },
  {
    "id": "f0b169e1-2d3a-40c2-b09c-5f44e7eb991e",
    "name": "Soyabean",
    "parent_id": "87b092b3-b276-4f25-876e-18126ccca0d3"
  },
  {
    "id": "2f6de667-d7a8-463f-b33e-f74a3aeb49d9",
    "name": "Sunflower Seed",
    "parent_id": "87b092b3-b276-4f25-876e-18126ccca0d3"
  },
  {
    "id": "732bbdf0-bd3b-4cd4-9477-2d4d7c4d4bff",
    "name": "Copra",
    "parent_id": "87b092b3-b276-4f25-876e-18126ccca0d3"
  },
  {
    "id": "8b316269-d88b-421c-b253-8899d10f3d4c",
    "name": "Palm Oil",
    "parent_id": "87b092b3-b276-4f25-876e-18126ccca0d3"
  },
  {
    "id": "2736e78c-1cfc-4a75-9750-e1917ec9f66c",
    "name": "Kernel Oil",
    "parent_id": "87b092b3-b276-4f25-876e-18126ccca0d3"
  },
  {
    "id": "f0b60465-3735-45bb-8a9a-6f260f050cad",
    "name": "Cotton",
    "parent_id": "c0d405ef-6d98-486b-b311-2dba7426f94d"
  },
  {
    "id": "78a159f6-73f3-4005-8250-63dc48086faf",
    "name": "Cotton Bale",
    "parent_id": "f0b60465-3735-45bb-8a9a-6f260f050cad"
  },
  {
    "id": "15229285-cd2f-46ba-9dd0-e58437d873cd",
    "name": "Cotton Seed",
    "parent_id": "f0b60465-3735-45bb-8a9a-6f260f050cad"
  },
  {
    "id": "2b739def-c9f0-4b61-9b55-2895bff6eced",
    "name": "Spices",
    "parent_id": "c0d405ef-6d98-486b-b311-2dba7426f94d"
  },
  {
    "id": "241532c8-bee8-4f24-a93c-413cad97176f",
    "name": "Cardamom",
    "parent_id": "2b739def-c9f0-4b61-9b55-2895bff6eced"
  },
  {
    "id": "492faba9-9b82-4e00-8325-631fbb316cce",
    "name": "Pepper",
    "parent_id": "2b739def-c9f0-4b61-9b55-2895bff6eced"
  },
  {
    "id": "bc9ea5e2-caf0-443a-9b79-cf914848234d",
    "name": "Onion",
    "parent_id": "2b739def-c9f0-4b61-9b55-2895bff6eced"
  },
  {
    "id": "34cab286-256f-4807-86db-c31e33998be9",
    "name": "Ginger",
    "parent_id": "2b739def-c9f0-4b61-9b55-2895bff6eced"
  },
  {
    "id": "43655e35-277c-49e8-97a1-097ba8424566",
    "name": "Others",
    "parent_id": "c0d405ef-6d98-486b-b311-2dba7426f94d"
  },
  {
    "id": "1c731e36-26b7-4230-bdcf-4c5700f4bf28",
    "name": "Makhana/Fox Nut",
    "parent_id": "43655e35-277c-49e8-97a1-097ba8424566"
  },
  {
    "id": "2c8cecb6-1e92-4bf6-94ae-770348f68d17",
    "name": "Medicinal Plants/ Plant parts",
    "parent_id": "43655e35-277c-49e8-97a1-097ba8424566"
  },
  {
    "id": "ff46e7d5-7c3e-46fb-af9b-d161109d1be1",
    "name": "Plantation",
    "parent_id": "43655e35-277c-49e8-97a1-097ba8424566"
  },
  {
    "id": "84f1f31a-6944-4791-8201-6b25e0ae6ee3",
    "name": "Cashew",
    "parent_id": "c0d405ef-6d98-486b-b311-2dba7426f94d"
  },
  {
    "id": "a69919f6-60c4-42e7-943b-7ea10ecd6f3d",
    "name": "Arecanut/betel nut",
    "parent_id": "c0d405ef-6d98-486b-b311-2dba7426f94d"
  },
  {
    "id": "95a649c5-eccf-4dde-8de8-bdd898d0c7bf",
    "name": "Coconut",
    "parent_id": "c0d405ef-6d98-486b-b311-2dba7426f94d"
  },
  {
    "id": "f7d30207-044f-4530-be11-7e425ab8978a",
    "name": "Aquatic Produce",
    "parent_id": null
  },
  {
    "id": "64b5e2da-4503-47fc-8f44-02e5cfa4933d",
    "name": "Fish",
    "parent_id": "f7d30207-044f-4530-be11-7e425ab8978a"
  },
  {
    "id": "314a6ca6-a8e2-41c6-8e5c-a60e040d5396",
    "name": "Ash",
    "parent_id": null
  },
  {
    "id": "06355049-9ace-4f55-9257-40c889d71c0f",
    "name": "Fly ash",
    "parent_id": "314a6ca6-a8e2-41c6-8e5c-a60e040d5396"
  },
  {
    "id": "c377ff72-684b-425f-bd63-23b0c60328b9",
    "name": "Pond ash",
    "parent_id": "314a6ca6-a8e2-41c6-8e5c-a60e040d5396"
  },
  {
    "id": "41245ccf-fc85-40b4-80b9-1181ac955783",
    "name": "Bottom ash",
    "parent_id": "314a6ca6-a8e2-41c6-8e5c-a60e040d5396"
  },
  {
    "id": "567fbf5f-548a-4ba3-868a-bae0bbd9869f",
    "name": "Chemicals",
    "parent_id": null
  },
  {
    "id": "673e4adf-6f0d-404a-a02e-eb3f79d3c9f4",
    "name": "Paints, dyes and pigments",
    "parent_id": "567fbf5f-548a-4ba3-868a-bae0bbd9869f"
  },
  {
    "id": "216f26ea-e756-4e29-a503-a2995b516ef4",
    "name": "Spent catalyst",
    "parent_id": "567fbf5f-548a-4ba3-868a-bae0bbd9869f"
  },
  {
    "id": "625d321f-005c-49c1-b6bb-a5dd6a547491",
    "name": "Others",
    "parent_id": "567fbf5f-548a-4ba3-868a-bae0bbd9869f"
  },
  {
    "id": "607026c5-7209-4675-b724-7814e9cd35da",
    "name": "Resins",
    "parent_id": "567fbf5f-548a-4ba3-868a-bae0bbd9869f"
  },
  {
    "id": "afcc86e4-dd3c-4342-b048-d96cd4f3764b",
    "name": "Acid",
    "parent_id": "567fbf5f-548a-4ba3-868a-bae0bbd9869f"
  },
  {
    "id": "939eaec6-f775-40cd-afe4-6e3875df9864",
    "name": "Coal",
    "parent_id": null
  },
  {
    "id": "bcb6a6f0-eb18-4033-8291-27ef051950d2",
    "name": "Coal",
    "parent_id": "939eaec6-f775-40cd-afe4-6e3875df9864"
  },
  {
    "id": "c1a276ef-6941-42b8-85fe-4cba78360bb3",
    "name": "Coal linkage",
    "parent_id": "939eaec6-f775-40cd-afe4-6e3875df9864"
  },
  {
    "id": "cbec990f-7ad1-428e-813a-14d70e6147ae",
    "name": "Lignite",
    "parent_id": "939eaec6-f775-40cd-afe4-6e3875df9864"
  },
  {
    "id": "42b0630a-d965-42fc-a051-2b1c6f61726e",
    "name": "Coal by products",
    "parent_id": "939eaec6-f775-40cd-afe4-6e3875df9864"
  },
  {
    "id": "badce075-96c8-4fd3-bf2e-dede2d88a068",
    "name": "Graphite Fines",
    "parent_id": "42b0630a-d965-42fc-a051-2b1c6f61726e"
  },
  {
    "id": "4e1bf6e7-71f6-4df2-977e-ae144ae54744",
    "name": "Met Coke Dust/Fines",
    "parent_id": "42b0630a-d965-42fc-a051-2b1c6f61726e"
  },
  {
    "id": "c5b7ec28-4c97-4ae6-bcc0-ac97b77ff9ce",
    "name": "Container",
    "parent_id": null
  },
  {
    "id": "24f860b3-10a1-44d0-a017-13d19c75f289",
    "name": "Barrel/drum",
    "parent_id": "c5b7ec28-4c97-4ae6-bcc0-ac97b77ff9ce"
  },
  {
    "id": "1d481598-a776-4644-b7b1-97d57146dee2",
    "name": "MS Barrel/Drum",
    "parent_id": "24f860b3-10a1-44d0-a017-13d19c75f289"
  },
  {
    "id": "6218c25f-dc1a-427e-97e2-e90183fd5214",
    "name": "Plastic Barrel/Drum",
    "parent_id": "24f860b3-10a1-44d0-a017-13d19c75f289"
  },
  {
    "id": "ae19403d-76ee-4016-a991-3ff7031fb0ef",
    "name": "Can/tin",
    "parent_id": "c5b7ec28-4c97-4ae6-bcc0-ac97b77ff9ce"
  },
  {
    "id": "5b59325e-5e6a-4fb2-8dfb-c85f7fba471f",
    "name": "Diamond",
    "parent_id": null
  },
  {
    "id": "be045e20-bd9d-4f5e-85ca-187219046e51",
    "name": "Rough diamond",
    "parent_id": "5b59325e-5e6a-4fb2-8dfb-c85f7fba471f"
  },
  {
    "id": "56ac16eb-ece5-4120-8c9e-87934a4cb60b",
    "name": "Gem-individual",
    "parent_id": "5b59325e-5e6a-4fb2-8dfb-c85f7fba471f"
  },
  {
    "id": "f4b8186e-24c2-48cd-9664-f8fbf2124391",
    "name": "Gem-packets",
    "parent_id": "5b59325e-5e6a-4fb2-8dfb-c85f7fba471f"
  },
  {
    "id": "d8a4b952-8dd5-4eda-b511-6051d3b9e2c5",
    "name": "Off colour-packets",
    "parent_id": "5b59325e-5e6a-4fb2-8dfb-c85f7fba471f"
  },
  {
    "id": "123dc1f6-172c-4c37-80f4-75dcf1222b3b",
    "name": "Darkbrown-packets",
    "parent_id": "5b59325e-5e6a-4fb2-8dfb-c85f7fba471f"
  },
  {
    "id": "a0888c19-0ad9-47fa-8949-486745cb0bee",
    "name": "Electrical Items",
    "parent_id": null
  },
  {
    "id": "ad398934-02f5-44e0-ad3f-6a4d76f9de11",
    "name": "Air conditioner/ac plant",
    "parent_id": "a0888c19-0ad9-47fa-8949-486745cb0bee"
  },
  {
    "id": "5f92b471-8627-4305-8ecd-8be1dfd4b6b4",
    "name": "Battery",
    "parent_id": "a0888c19-0ad9-47fa-8949-486745cb0bee"
  },
  {
    "id": "43c858d4-bd43-4483-b0df-bcf183726ae9",
    "name": "Cables",
    "parent_id": "a0888c19-0ad9-47fa-8949-486745cb0bee"
  },
  {
    "id": "d99f692a-6df8-47a8-841c-802c4a8c997d",
    "name": "Transformer",
    "parent_id": "a0888c19-0ad9-47fa-8949-486745cb0bee"
  },
  {
    "id": "d401d4c4-1435-42b9-a046-994cf52aba36",
    "name": "Others",
    "parent_id": "a0888c19-0ad9-47fa-8949-486745cb0bee"
  },
  {
    "id": "02c9848e-c4d9-41ba-b826-0e8b027fe1c7",
    "name": "Dg sets/generators",
    "parent_id": "a0888c19-0ad9-47fa-8949-486745cb0bee"
  },
  {
    "id": "6d9c1c3c-d686-4b0f-9e2c-bacf0b0cdca7",
    "name": "Conductors",
    "parent_id": "a0888c19-0ad9-47fa-8949-486745cb0bee"
  },
  {
    "id": "d5286a28-7ad0-46a6-8553-9cc81d91d07b",
    "name": "AAC",
    "parent_id": "6d9c1c3c-d686-4b0f-9e2c-bacf0b0cdca7"
  },
  {
    "id": "91e0bc51-c68a-4543-8c3e-f36598e07a4a",
    "name": "AAAC",
    "parent_id": "6d9c1c3c-d686-4b0f-9e2c-bacf0b0cdca7"
  },
  {
    "id": "6e5dce16-a71f-474c-9263-aff62476fc86",
    "name": "ACSR",
    "parent_id": "6d9c1c3c-d686-4b0f-9e2c-bacf0b0cdca7"
  },
  {
    "id": "65932565-c3a8-4955-8d7a-a10e7b8a3aed",
    "name": "Circuit breaker",
    "parent_id": "a0888c19-0ad9-47fa-8949-486745cb0bee"
  },
  {
    "id": "f1ae3837-565a-4741-90d8-069b1a15b084",
    "name": "Meter scrap",
    "parent_id": "a0888c19-0ad9-47fa-8949-486745cb0bee"
  },
  {
    "id": "04a03d13-dc08-4c28-b5b1-cbbcf99e8110",
    "name": "Crgo scrap",
    "parent_id": "a0888c19-0ad9-47fa-8949-486745cb0bee"
  },
  {
    "id": "5227c117-b21a-4cde-9986-f62257b11ed6",
    "name": "Electronics Items",
    "parent_id": null
  },
  {
    "id": "02bc3b81-1632-4415-a40e-a517006696fc",
    "name": "Compters/peripherals",
    "parent_id": "5227c117-b21a-4cde-9986-f62257b11ed6"
  },
  {
    "id": "ca8fe05b-90e1-44a1-b5a6-957cc6ee1ec0",
    "name": "Others",
    "parent_id": "5227c117-b21a-4cde-9986-f62257b11ed6"
  },
  {
    "id": "d9e0d3ba-7597-490f-909f-ed85b39cee92",
    "name": "Mobile/tablet",
    "parent_id": "5227c117-b21a-4cde-9986-f62257b11ed6"
  },
  {
    "id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee",
    "name": "Forest Produce",
    "parent_id": null
  },
  {
    "id": "76e9a34b-9d8e-4948-962f-984ac2ebf767",
    "name": "Timber",
    "parent_id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee"
  },
  {
    "id": "aacf442b-7972-469c-840b-db95eacfca52",
    "name": "Poles",
    "parent_id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee"
  },
  {
    "id": "05aec29a-5162-40dc-8e3b-d3095a8e2d29",
    "name": "Billets",
    "parent_id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee"
  },
  {
    "id": "bf963d7d-38fe-414d-a9b8-fbb80e4c0844",
    "name": "Ntfd",
    "parent_id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee"
  },
  {
    "id": "70a1e466-659a-482a-a0e0-c950915fd7e1",
    "name": "Canes",
    "parent_id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee"
  },
  {
    "id": "194543c5-2d57-445e-92f3-15252dc8e136",
    "name": "Timber - teak",
    "parent_id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee"
  },
  {
    "id": "1c40eeb7-7cfa-4c4a-88e1-372f95b96e42",
    "name": "Timber - rosewood",
    "parent_id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee"
  },
  {
    "id": "2e455748-0748-4046-90a8-c5a576ce1481",
    "name": "Timber - others",
    "parent_id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee"
  },
  {
    "id": "8db870bf-5007-4450-9795-c060f5db4b59",
    "name": "Timber cut sizes",
    "parent_id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee"
  },
  {
    "id": "cfd9c4ba-f57c-4107-bf62-a9c22a3819f5",
    "name": "Sandal wood",
    "parent_id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee"
  },
  {
    "id": "530c9019-0fc9-4ea5-9e57-238ccb532596",
    "name": "Red sander",
    "parent_id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee"
  },
  {
    "id": "f6c77cbf-0a26-42da-b9d9-668f7906d90d",
    "name": "Sandalwood oil",
    "parent_id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee"
  },
  {
    "id": "865911a2-eeab-413e-8eab-6f370a34f198",
    "name": "Poles- teak",
    "parent_id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee"
  },
  {
    "id": "333ddbc4-7259-4518-a46f-c0f4e57f2f03",
    "name": "Poles - others",
    "parent_id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee"
  },
  {
    "id": "e34d0f34-6bfb-40a7-b300-36a2716e8f63",
    "name": "Pulpwood",
    "parent_id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee"
  },
  {
    "id": "033cd0af-2f42-4c63-8fc5-32430fb29b8d",
    "name": "Firewood",
    "parent_id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee"
  },
  {
    "id": "ab5ba5e4-be36-484a-b5d8-2fc1aa3f1f24",
    "name": "Tendu leaves",
    "parent_id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee"
  },
  {
    "id": "2dc0d58b-0d6c-40c9-9933-08653ed06348",
    "name": "Others",
    "parent_id": "b8f30b6b-14d3-488e-98a7-188ec51cbbee"
  },
  {
    "id": "75ce4b50-5d02-4282-a6bb-185cd7f98bb3",
    "name": "Immovable Property",
    "parent_id": null
  },
  {
    "id": "946b2a97-a8a9-4e0a-91c5-ee054808e783",
    "name": "Residential",
    "parent_id": "75ce4b50-5d02-4282-a6bb-185cd7f98bb3"
  },
  {
    "id": "938d181d-f4e3-4753-8d21-2a38bd6dae69",
    "name": "Flat",
    "parent_id": "946b2a97-a8a9-4e0a-91c5-ee054808e783"
  },
  {
    "id": "a52c8e87-29c0-4090-a282-7ad9edf3014e",
    "name": "Plot/Land",
    "parent_id": "946b2a97-a8a9-4e0a-91c5-ee054808e783"
  },
  {
    "id": "fc723e86-16b6-4521-8869-6aa0c75c6109",
    "name": "Independent House",
    "parent_id": "946b2a97-a8a9-4e0a-91c5-ee054808e783"
  },
  {
    "id": "2462aad5-be3d-460a-8d39-da271d02d606",
    "name": "Commercial",
    "parent_id": "75ce4b50-5d02-4282-a6bb-185cd7f98bb3"
  },
  {
    "id": "8930be4d-a3d0-4b7e-81b2-779d4b681477",
    "name": "Shops",
    "parent_id": "2462aad5-be3d-460a-8d39-da271d02d606"
  },
  {
    "id": "bb58a17e-edf7-4777-b009-31269e0428cb",
    "name": "Showroom",
    "parent_id": "2462aad5-be3d-460a-8d39-da271d02d606"
  },
  {
    "id": "726a0f26-d0c9-4d1a-8a14-e13a98cc4851",
    "name": "Office",
    "parent_id": "2462aad5-be3d-460a-8d39-da271d02d606"
  },
  {
    "id": "d04f5851-aa75-4549-a441-9c2d9cf28861",
    "name": "Land/Plot",
    "parent_id": "2462aad5-be3d-460a-8d39-da271d02d606"
  },
  {
    "id": "2de92113-a1d9-47c2-b5ae-8775f0e2000c",
    "name": "Buildings",
    "parent_id": "2462aad5-be3d-460a-8d39-da271d02d606"
  },
  {
    "id": "4ae2d787-ba54-4303-b5f1-a3f6c2a906df",
    "name": "Malls",
    "parent_id": "2462aad5-be3d-460a-8d39-da271d02d606"
  },
  {
    "id": "cc519d28-6832-46f4-87c5-871b9c6bb480",
    "name": "Storage Space",
    "parent_id": "2462aad5-be3d-460a-8d39-da271d02d606"
  },
  {
    "id": "4df9f944-c17f-4ee4-b09b-03ff31ea5a33",
    "name": "Godowns",
    "parent_id": "2462aad5-be3d-460a-8d39-da271d02d606"
  },
  {
    "id": "875f80f6-361f-4901-8bd4-d4a1ec0afdb5",
    "name": "Hoardings",
    "parent_id": "2462aad5-be3d-460a-8d39-da271d02d606"
  },
  {
    "id": "edb223b6-a074-42c4-97d2-765aaca6a7a7",
    "name": "Bus Adda",
    "parent_id": "2462aad5-be3d-460a-8d39-da271d02d606"
  },
  {
    "id": "695052e9-d656-4bb3-a007-7ecef9143247",
    "name": "Parking Lot",
    "parent_id": "2462aad5-be3d-460a-8d39-da271d02d606"
  },
  {
    "id": "9c5c3cb6-29fc-4a82-9da2-45c8761a09ed",
    "name": "Toilets/Bathrooms/Washrooms",
    "parent_id": "2462aad5-be3d-460a-8d39-da271d02d606"
  },
  {
    "id": "b790aaf6-8a54-431f-908f-3bdd1e137134",
    "name": "Agriculture",
    "parent_id": "75ce4b50-5d02-4282-a6bb-185cd7f98bb3"
  },
  {
    "id": "f3227f63-d3d9-438c-b9dc-c80a29de2e65",
    "name": "Land/Plot",
    "parent_id": "b790aaf6-8a54-431f-908f-3bdd1e137134"
  },
  {
    "id": "a3def47f-871c-4abc-ad3a-371332e040d0",
    "name": "Farmhouse",
    "parent_id": "b790aaf6-8a54-431f-908f-3bdd1e137134"
  },
  {
    "id": "70e2f630-8a0d-44c7-a865-172f988dad42",
    "name": "Agriculture",
    "parent_id": "b790aaf6-8a54-431f-908f-3bdd1e137134"
  },
  {
    "id": "3c2b1cb3-bca2-4706-a303-fd55bd776e5f",
    "name": "Industry",
    "parent_id": "75ce4b50-5d02-4282-a6bb-185cd7f98bb3"
  },
  {
    "id": "6d5df8c1-69bd-47cb-9709-994e28660ff7",
    "name": "Building",
    "parent_id": "3c2b1cb3-bca2-4706-a303-fd55bd776e5f"
  },
  {
    "id": "4305769a-59df-409e-9858-56ddcf09e09c",
    "name": "Land/Plot",
    "parent_id": "3c2b1cb3-bca2-4706-a303-fd55bd776e5f"
  },
  {
    "id": "f6faf3b8-018d-4ecd-9857-80456eee6d7d",
    "name": "Warehouse",
    "parent_id": "3c2b1cb3-bca2-4706-a303-fd55bd776e5f"
  },
  {
    "id": "fb06a9b8-3510-483f-bffa-272c524ad0fc",
    "name": "Industrial Shed",
    "parent_id": "3c2b1cb3-bca2-4706-a303-fd55bd776e5f"
  },
  {
    "id": "a630e7dd-d867-4612-839c-1bc6d377b3f8",
    "name": "Shed with Plant and Machinery",
    "parent_id": "3c2b1cb3-bca2-4706-a303-fd55bd776e5f"
  },
  {
    "id": "22528b73-45c8-407e-ae9b-bbf894d4b908",
    "name": "Others",
    "parent_id": "75ce4b50-5d02-4282-a6bb-185cd7f98bb3"
  },
  {
    "id": "53d9fec5-a2fa-447b-a0f3-e5b8dae35eff",
    "name": "Liquor License Contracts",
    "parent_id": null
  },
  {
    "id": "8118eb92-e307-44c5-be9e-19ad428e80b1",
    "name": "Liquor shop license",
    "parent_id": "53d9fec5-a2fa-447b-a0f3-e5b8dae35eff"
  },
  {
    "id": "779dba77-7f35-44ac-b51f-293817cc917a",
    "name": "Metal",
    "parent_id": null
  },
  {
    "id": "46fc6d5c-4897-4837-8b79-e8a46219edc3",
    "name": "Iron and steel",
    "parent_id": "779dba77-7f35-44ac-b51f-293817cc917a"
  },
  {
    "id": "440b010d-72cf-47d2-acf1-b3854cbf3b62",
    "name": "Aluminium",
    "parent_id": "779dba77-7f35-44ac-b51f-293817cc917a"
  },
  {
    "id": "e189cf88-e62d-471a-8aaf-0e68be9740a4",
    "name": "Brass",
    "parent_id": "779dba77-7f35-44ac-b51f-293817cc917a"
  },
  {
    "id": "b344b3eb-abc3-4c99-a42b-e7b03a9b1757",
    "name": "Copper",
    "parent_id": "779dba77-7f35-44ac-b51f-293817cc917a"
  },
  {
    "id": "1503fcbe-e18f-4053-bccc-1ade145dcaf0",
    "name": "Lead",
    "parent_id": "779dba77-7f35-44ac-b51f-293817cc917a"
  },
  {
    "id": "85add2f9-7cf5-4ef9-b4bf-52970f57bb79",
    "name": "Gold",
    "parent_id": "779dba77-7f35-44ac-b51f-293817cc917a"
  },
  {
    "id": "b1b8889a-4acf-4846-8843-f9a5866bcaee",
    "name": "Platinum",
    "parent_id": "779dba77-7f35-44ac-b51f-293817cc917a"
  },
  {
    "id": "675490b2-4b05-4add-b339-318e7d767e10",
    "name": "Silver",
    "parent_id": "779dba77-7f35-44ac-b51f-293817cc917a"
  },
  {
    "id": "9de009ad-775b-4db1-83be-e8f0fb640838",
    "name": "Zinc",
    "parent_id": "779dba77-7f35-44ac-b51f-293817cc917a"
  },
  {
    "id": "d31ed639-4817-48a8-9275-502d1a28f33a",
    "name": "Nickle",
    "parent_id": "779dba77-7f35-44ac-b51f-293817cc917a"
  },
  {
    "id": "e534ba33-2f45-46cb-b806-b014ff5d22f6",
    "name": "Gun metal/bronze",
    "parent_id": "779dba77-7f35-44ac-b51f-293817cc917a"
  },
  {
    "id": "0a65a361-6377-4425-8b49-e788df2bb183",
    "name": "Other metals",
    "parent_id": "779dba77-7f35-44ac-b51f-293817cc917a"
  },
  {
    "id": "eb9b18fe-20dd-459b-9af3-14a0c4248365",
    "name": "Mixed metal scraps",
    "parent_id": "779dba77-7f35-44ac-b51f-293817cc917a"
  },
  {
    "id": "2e3db410-d02b-4093-8e40-456eb16305b5",
    "name": "Mine Block",
    "parent_id": null
  },
  {
    "id": "f449420d-de2e-4d94-94de-2b65690b99d8",
    "name": "Mine block",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "f31bed16-8cdd-478f-84f7-2962bee0f56f",
    "name": "Coal mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "a65cd1ce-cd6e-4568-91fd-df150895508c",
    "name": "Iron ore mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "95720651-7702-4057-9b30-22aaa2657b7c",
    "name": "Lime stone mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "9c0e08a1-3131-404c-96f8-94fa9b024aef",
    "name": "Graphite mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "73ce01e0-7b94-439a-95f6-531f5e4a7040",
    "name": "Gold mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "2328369a-aaa7-4785-84a6-5a137f55114c",
    "name": "Manganese ore mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "f1c67224-497b-4ec1-97ef-c95402549fe6",
    "name": "Diamond mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "a9b3e9fe-aaa7-4b2f-9c35-dfe69a6e2f2d",
    "name": "Bauxite mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "e95ba80d-ea13-4ac6-8b06-683813505586",
    "name": "Copper ore mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "999ba26c-f97d-42d6-a20c-175b70031dff",
    "name": "Platinum ore mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "7ca1ce18-839e-4703-8b9c-37a6a8e5c4bc",
    "name": "Sand block",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "0c760efd-0794-4ba1-b8f5-eec201197774",
    "name": "Murram block",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "b592250d-c77d-4916-a72a-cbbffe1ef7ac",
    "name": "Rcc/ercc",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "e11b6a86-c316-438a-9c3f-cdbf5166db47",
    "name": "Magnesite mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "c6b000a4-ffb5-4463-b2d7-2399d3e51e30",
    "name": "Decorative stone mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "0e1a2a1a-241d-4f0a-a6c8-21e3e681af59",
    "name": "Limestone mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "52a81e30-80a1-4ed2-bca7-9275067255fb",
    "name": "Phosphorite mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "d538be2c-f0f3-454b-9eaf-dcb08339e581",
    "name": "Basemetal  mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "db523cdb-ec55-4410-a7f2-7f0927755174",
    "name": "Vanadium mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "29ee5ccb-4218-4e65-a0de-e80319172e74",
    "name": "Iron ore & manganese ore mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "1a73484c-2648-4471-8237-5cfe71f637a2",
    "name": "Gold and basemetal mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "2ebc37e4-4140-4b1e-a23f-bf4cdc96495b",
    "name": "Graphite & vanadium mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "25cc999a-8f73-499c-aaaf-a88ce35da53b",
    "name": "Flourite mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "7042341f-2284-4640-aabf-49f102a33d47",
    "name": "Siliceous earth mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "10aaec92-1c68-49e6-a3d7-593b29b5ccc6",
    "name": "Potash mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "9abc2e94-235d-4c97-a76a-1a6e7be6e854",
    "name": "Rare earth elements mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "690ad9af-ac63-4dd7-912b-4afbd01c5a0c",
    "name": "Garnet mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "9f5fc220-f5cb-481b-96c4-8b15dca7301f",
    "name": "Copper lead zinc mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "d106cabf-fda7-4e99-8ec9-7fcf52700e16",
    "name": "Copper and associated gold mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "be0e9ddb-8f73-4258-b59c-d606d4f30916",
    "name": "Lead zinc mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "e8e2252e-1543-4e8b-bb70-af1de38b360d",
    "name": "Emerald mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "1bf9f153-ab22-40b4-b04f-ff4c59e53972",
    "name": "Ordinary sand mine",
    "parent_id": "2e3db410-d02b-4093-8e40-456eb16305b5"
  },
  {
    "id": "f595e312-5f80-4843-b14f-b27a2ab76fcf",
    "name": "Minerals",
    "parent_id": null
  },
  {
    "id": "2e3b36e1-16a4-4449-b5e3-6405e5c066b6",
    "name": "Blue stone",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "2a64e0eb-742c-4daf-9b0b-e22450cf6856",
    "name": "Iron ore",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "b8c67767-184f-49fd-aaaa-84a790ff8a25",
    "name": "Mixed - Fines and Lumps",
    "parent_id": "2a64e0eb-742c-4daf-9b0b-e22450cf6856"
  },
  {
    "id": "bddbe823-fbf6-428c-a378-ae550990faf5",
    "name": "Manganese/ferro-manganese ore",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "d175c45a-1b60-4659-9bb4-0dc6cf2ee943",
    "name": "Sand",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "0f47205e-ea64-48ed-a328-c276aa5f7bbe",
    "name": "Clay",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "1be9d9f2-cd55-47d2-906b-203afe311ac9",
    "name": "Chrome ore",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "4f4e2737-7cfd-4246-b963-30ac0ce62f76",
    "name": "Baryte",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "966ab246-7722-43e9-81e9-8276da2abc8b",
    "name": "Dolomite",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "04f1db98-8fb3-4819-9898-d111bdb49f35",
    "name": "Granite",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "3ded1d4c-c97a-49ee-b73d-41d56ba281a4",
    "name": "Limestone",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "440c823e-3e73-4cdd-a790-42b116d0e7ba",
    "name": "Marble",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "693b1b11-5905-4859-bc7a-fc5beffdc0d7",
    "name": "Silica sand",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "29de5bed-f69e-4576-b58e-8e7649f6f587",
    "name": "Gypsum",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "be5a6e18-e2b7-4a06-ac39-6759b1303f76",
    "name": "Fluorspar",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "047bc09b-22b1-4d6a-bf0e-9207b0c97fbb",
    "name": "Weathered/mixed stone",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "fc4def54-80b3-4d86-a948-ba752189c727",
    "name": "Inferior quality material",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "989a7932-7bff-4bca-a64c-4238ca959fda",
    "name": "M-sand",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "f62b7c80-095e-4764-9301-ade895f1a3ae",
    "name": "Bauxite",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "c80dfd11-4f03-49cf-a64a-6f4ca2f1517f",
    "name": "Magnesite",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "4ea0d40c-1f6b-41ca-b39e-eb2806e569ba",
    "name": "Dunite",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "6b8c1c1a-632a-45ad-971c-20780e578dd0",
    "name": "Salt",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "609580b1-2428-4ed4-bca3-3b8f1dec7bc9",
    "name": "Low graded/nala sand",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "f3b3d187-e4f4-4e84-8cfc-949209af0469",
    "name": "Primarily blue stone",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "0b4712da-f051-40cc-b577-43ae10b062a1",
    "name": "Rock phosphate",
    "parent_id": "f595e312-5f80-4843-b14f-b27a2ab76fcf"
  },
  {
    "id": "89084baf-0e5f-4504-ad48-41fd3b49bd87",
    "name": "Miscellaneous",
    "parent_id": null
  },
  {
    "id": "74425650-6a0a-4063-afdc-10ee42cd390e",
    "name": "Plastic",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "6a71cbf0-ab7f-4315-8f36-658290821327",
    "name": "Leather",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "729a69df-4c34-4ba3-b414-783cfd3c921a",
    "name": "Rubber",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "edb03a61-3045-402b-862b-daa75775ae8e",
    "name": "Building materials",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "c8e36ccc-5044-4a42-a3bd-9e7d421c501a",
    "name": "Cenosphere",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "edd7265a-9c9a-4dd4-8caa-fcaa45ec5334",
    "name": "Dismantaling of buildings/plants",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "17773548-55e9-4870-a838-e4abf606b93a",
    "name": "Furniture",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "1b558906-0cca-431c-a835-2281579238f5",
    "name": "Wooden items",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "028fa858-b391-4f5d-afad-55021d61a111",
    "name": "Scrips",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "12a9c00c-d7d1-451f-bee6-eec0519350ef",
    "name": "Miscellaneous items",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "a50cffa9-cbd4-4027-bbfe-359b0a29fd64",
    "name": "Fgd gypsum",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "6a53fecc-4148-4e49-8f81-ae34e43d9479",
    "name": "Paper and related products",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "dc16b290-a168-4b0c-8b55-5786189f500f",
    "name": "Paper",
    "parent_id": "6a53fecc-4148-4e49-8f81-ae34e43d9479"
  },
  {
    "id": "93e2706d-f0f5-49c5-a564-74df9b14e6f7",
    "name": "Board",
    "parent_id": "6a53fecc-4148-4e49-8f81-ae34e43d9479"
  },
  {
    "id": "0eefa13e-f436-4e06-8823-828015cd95a4",
    "name": "Cartoons",
    "parent_id": "6a53fecc-4148-4e49-8f81-ae34e43d9479"
  },
  {
    "id": "584e3153-59f8-409a-9d47-17f4d5db8263",
    "name": "Paper Bricks",
    "parent_id": "6a53fecc-4148-4e49-8f81-ae34e43d9479"
  },
  {
    "id": "7b330d21-b868-4f04-a6b6-135eb7da0617",
    "name": "others",
    "parent_id": "6a53fecc-4148-4e49-8f81-ae34e43d9479"
  },
  {
    "id": "03990dc0-7491-41ae-8c6c-bc4c682b74ec",
    "name": "Cloth/garments",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "d2d059f2-99f8-4cfe-a321-7361260df372",
    "name": "Fabric/Yarn/Cloth",
    "parent_id": "03990dc0-7491-41ae-8c6c-bc4c682b74ec"
  },
  {
    "id": "0ab714be-f6aa-469b-aec6-ae4f67700b29",
    "name": "Garbage/Sweeping Dust/Broom Waste",
    "parent_id": "03990dc0-7491-41ae-8c6c-bc4c682b74ec"
  },
  {
    "id": "2984dc3c-f179-4699-929e-e1f097e62439",
    "name": "Glass",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "4f89621c-f437-44ca-85ad-54779760da83",
    "name": "Medical",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "d5e0941d-98c4-4180-bd05-39e2bea07e06",
    "name": "Medical Equipment",
    "parent_id": "4f89621c-f437-44ca-85ad-54779760da83"
  },
  {
    "id": "05fc1934-ccdc-4b22-b91e-af92ddc9d5c8",
    "name": "Medical Waste",
    "parent_id": "4f89621c-f437-44ca-85ad-54779760da83"
  },
  {
    "id": "8857b7fa-91de-4716-8eac-a58afcd3f622",
    "name": "Medical Machinery",
    "parent_id": "4f89621c-f437-44ca-85ad-54779760da83"
  },
  {
    "id": "0ad6642b-c2fb-4087-98ba-43cb514a8e1d",
    "name": "Lab Equipment",
    "parent_id": "4f89621c-f437-44ca-85ad-54779760da83"
  },
  {
    "id": "cedfe84a-a6af-473c-8338-acf14a2dfa96",
    "name": "Medicines",
    "parent_id": "4f89621c-f437-44ca-85ad-54779760da83"
  },
  {
    "id": "62a8f493-d228-4ea0-aa2b-9fca6b5d2193",
    "name": "Garbage/sweeping dust/broom waste",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "600127da-25e1-4cff-b67f-09202bca8e87",
    "name": "Human hair",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "738dae06-26e4-4858-9fab-3d90b1521989",
    "name": "Silk cocoons",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "4f5a1791-149b-4a4f-8be4-91463ab2ae63",
    "name": "Fibre scrap or fiber glass scrap",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "ffa0a728-febe-4708-b080-8dbccb7bffc7",
    "name": "Footwear",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "893f9e26-4b12-421d-b6ee-55495ac8ab3a",
    "name": "Packing material",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "0fb4cb00-77ae-4b25-8ec8-1a098620cc8f",
    "name": "Gunny Bags",
    "parent_id": "893f9e26-4b12-421d-b6ee-55495ac8ab3a"
  },
  {
    "id": "eb55a650-c01e-4f61-a85f-957b2b927f84",
    "name": "Jute Bags",
    "parent_id": "893f9e26-4b12-421d-b6ee-55495ac8ab3a"
  },
  {
    "id": "94cbeee0-1662-4003-bfa2-4cdd0608fabc",
    "name": "Corrugated Box",
    "parent_id": "893f9e26-4b12-421d-b6ee-55495ac8ab3a"
  },
  {
    "id": "52a0d33e-e9c4-46d0-9db5-45c6c97b9a9a",
    "name": "Textile",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "316beb78-fc64-4173-9105-f79e415ac7dd",
    "name": "Jute Items/Jute Waste",
    "parent_id": "52a0d33e-e9c4-46d0-9db5-45c6c97b9a9a"
  },
  {
    "id": "d5af6751-b4f1-47ec-a81e-4d22c605e6c8",
    "name": "Cotton Items/Cotton Waste",
    "parent_id": "52a0d33e-e9c4-46d0-9db5-45c6c97b9a9a"
  },
  {
    "id": "4a5cd07d-f0fd-418d-85d0-b9d9d4feb1f4",
    "name": "Tents/Tarpaulin",
    "parent_id": "52a0d33e-e9c4-46d0-9db5-45c6c97b9a9a"
  },
  {
    "id": "b1eb68da-ca4e-47f0-919d-b755555a5b39",
    "name": "Custom goods",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "f2c62720-38c8-4ffc-8375-47e2e5c3a324",
    "name": "Unclaimed/Uncleared Cargo",
    "parent_id": "b1eb68da-ca4e-47f0-919d-b755555a5b39"
  },
  {
    "id": "e334a58e-797a-49bf-a00c-eac762359f68",
    "name": "CFS Containers",
    "parent_id": "b1eb68da-ca4e-47f0-919d-b755555a5b39"
  },
  {
    "id": "b8e938ba-da85-4245-8661-23c6c5b48fc4",
    "name": "Safety equipment",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "7fa857a4-5a43-425c-93e8-b4cb2c52a7a8",
    "name": "Household and office items",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "20327c00-3ccd-4b52-b558-d0ef5903a12c",
    "name": "Artifacts",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "0f35978d-e5c9-45f3-a58a-4c66d3057d13",
    "name": "Musical instruments",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "4e505cda-4e8c-41b0-bae4-24aad2ae91bc",
    "name": "Tdr -transferrable development rights",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "98094270-ab57-4881-aba9-3b129539056a",
    "name": "Omda",
    "parent_id": "89084baf-0e5f-4504-ad48-41fd3b49bd87"
  },
  {
    "id": "72f04049-6799-4c22-9353-6ee480a25870",
    "name": "Petroleum Products",
    "parent_id": null
  },
  {
    "id": "ca5c58e1-4f62-415b-b6b8-74d0883a9dd3",
    "name": "Pet coke",
    "parent_id": "72f04049-6799-4c22-9353-6ee480a25870"
  },
  {
    "id": "53b9751a-9b76-4412-b016-5d534a6fc561",
    "name": "Used/ waste oil",
    "parent_id": "72f04049-6799-4c22-9353-6ee480a25870"
  },
  {
    "id": "208330bd-2a38-48dd-9464-3732bdccce10",
    "name": "Lubricants",
    "parent_id": "72f04049-6799-4c22-9353-6ee480a25870"
  },
  {
    "id": "562b834e-f72e-498c-ada8-c05dfb226cd1",
    "name": "Rlng",
    "parent_id": "72f04049-6799-4c22-9353-6ee480a25870"
  },
  {
    "id": "2905a432-3b67-4449-a365-bfc16f63fc43",
    "name": "Bitumen",
    "parent_id": "72f04049-6799-4c22-9353-6ee480a25870"
  },
  {
    "id": "5ab1ba54-7ae3-4d45-ad9b-8d700ac90bc4",
    "name": "Wax",
    "parent_id": "72f04049-6799-4c22-9353-6ee480a25870"
  },
  {
    "id": "fd943dad-e449-4466-8e0c-4b97f7ad192c",
    "name": "Plant/Machineries",
    "parent_id": null
  },
  {
    "id": "f542dfe9-138e-455b-8145-37eaf5b6d367",
    "name": "Plants",
    "parent_id": "fd943dad-e449-4466-8e0c-4b97f7ad192c"
  },
  {
    "id": "f461d583-ed4c-4bbc-85b8-750c2101777a",
    "name": "Machinery items",
    "parent_id": "fd943dad-e449-4466-8e0c-4b97f7ad192c"
  },
  {
    "id": "b16126ba-a234-4dbb-addb-78e3f139e180",
    "name": "Aircrafts",
    "parent_id": "fd943dad-e449-4466-8e0c-4b97f7ad192c"
  },
  {
    "id": "395996f8-5495-4dc8-b5a8-053710f80422",
    "name": "Crane/earth moving equipments",
    "parent_id": "fd943dad-e449-4466-8e0c-4b97f7ad192c"
  },
  {
    "id": "33a8302f-24cb-4982-954c-7090a1f8f243",
    "name": "Forklift",
    "parent_id": "395996f8-5495-4dc8-b5a8-053710f80422"
  },
  {
    "id": "bb981e90-5d91-4f5f-8b69-5f56f4e15ee0",
    "name": "Surplus stores/ spares",
    "parent_id": "fd943dad-e449-4466-8e0c-4b97f7ad192c"
  },
  {
    "id": "e7ea48ce-cc95-4ef1-afd0-98fed536079e",
    "name": "Engine assemblies/ vehicle comp.",
    "parent_id": "fd943dad-e449-4466-8e0c-4b97f7ad192c"
  },
  {
    "id": "4b0a0a3b-6ff8-45ef-ae96-3388dbecdd83",
    "name": "Tools & equipments",
    "parent_id": "fd943dad-e449-4466-8e0c-4b97f7ad192c"
  },
  {
    "id": "91f51941-16fc-4c1a-a67e-5d0223f8a695",
    "name": "Spare parts",
    "parent_id": "fd943dad-e449-4466-8e0c-4b97f7ad192c"
  },
  {
    "id": "38bc06cf-ee75-4d5a-b47e-952135e555ce",
    "name": "Transport Vehicles",
    "parent_id": null
  },
  {
    "id": "76ae5823-340c-4b2c-951a-178aec3c531e",
    "name": "Auto rikshaw",
    "parent_id": "38bc06cf-ee75-4d5a-b47e-952135e555ce"
  },
  {
    "id": "40460e3a-1e7d-4ba0-b760-ee9f1fc9f455",
    "name": "Two-wheller",
    "parent_id": "38bc06cf-ee75-4d5a-b47e-952135e555ce"
  },
  {
    "id": "149141b7-d711-40d8-a1ad-f041f0619324",
    "name": "Car",
    "parent_id": "38bc06cf-ee75-4d5a-b47e-952135e555ce"
  },
  {
    "id": "44e650d2-a7a3-4cfa-9a11-e814b2a629cc",
    "name": "Bus",
    "parent_id": "38bc06cf-ee75-4d5a-b47e-952135e555ce"
  },
  {
    "id": "8e3cd8c7-6aad-4d92-ba5d-da06f7b32b82",
    "name": "Truck",
    "parent_id": "38bc06cf-ee75-4d5a-b47e-952135e555ce"
  },
  {
    "id": "abb808d4-5e51-4afd-91f9-ff3e017bb04d",
    "name": "End of life vehicles",
    "parent_id": "38bc06cf-ee75-4d5a-b47e-952135e555ce"
  },
  {
    "id": "85841ea0-9d2e-49ef-bc7e-e7e8389c3c9d",
    "name": "Cycles",
    "parent_id": "38bc06cf-ee75-4d5a-b47e-952135e555ce"
  },
  {
    "id": "d72af759-2dd8-46b8-a130-50c7ce1fa1c7",
    "name": "E-rikshaw",
    "parent_id": "38bc06cf-ee75-4d5a-b47e-952135e555ce"
  },
  {
    "id": "b4680c7f-6e62-4f2b-b32d-f1c85c5e44fe",
    "name": "Spv - special purpose vehicle",
    "parent_id": "38bc06cf-ee75-4d5a-b47e-952135e555ce"
  },
  {
    "id": "54a61649-1a79-406c-bebe-e8db7980c519",
    "name": "Others",
    "parent_id": "38bc06cf-ee75-4d5a-b47e-952135e555ce"
  },
  {
    "id": "c3675902-f29e-41fb-9638-cf8f55415f87",
    "name": "Vessels",
    "parent_id": null
  },
  {
    "id": "98f179cb-5865-46ef-a466-57c56a74109c",
    "name": "Ship",
    "parent_id": "c3675902-f29e-41fb-9638-cf8f55415f87"
  },
  {
    "id": "5db15304-07f7-495d-938e-fd1fdab84ff8",
    "name": "Boat",
    "parent_id": "c3675902-f29e-41fb-9638-cf8f55415f87"
  },
  {
    "id": "7fa6c2df-46ab-405a-b2fc-b4be2117ee82",
    "name": "Tug",
    "parent_id": "c3675902-f29e-41fb-9638-cf8f55415f87"
  },
  {
    "id": "906f4a75-963d-4943-9e5f-981cbb7d33bb",
    "name": "Barge",
    "parent_id": "c3675902-f29e-41fb-9638-cf8f55415f87"
  },
  {
    "id": "bc35bca8-2e02-4d23-ad49-3d8941716823",
    "name": "Dredger",
    "parent_id": "c3675902-f29e-41fb-9638-cf8f55415f87"
  }
];
