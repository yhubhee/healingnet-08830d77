# E2E cleanup

Every record the end-to-end tests created in the live project, by table and id. Nothing has been deleted.

Taken from the database on 2026-10-29, after pass 3, by searching every text column of every `public` table for `[E2E]`. Linked rows that carry no `[E2E]` text of their own (check-ins, maternity records, lab orders) are found through their `[E2E]` patient or test. The test patient, doctor and hospital accounts are Bhee's and are **not** listed.

To list them again (the same search, any time):

```sql
select id, reason from public.patient_appointments where reason like '%[E2E]%' or decline_reason like '%[E2E]%';
-- and likewise: <table> where <text column> like '%[E2E]%' for the tables below
```

Delete children before parents (for example `consultation_treatment_items`, `prescriptions` and `lab_result_tests` before `consultations` and `lab_results`; everything for a patient before the `[E2E]` patient itself). Several foreign keys cascade, so some rows below go with their parent.

## Rows with `[E2E]` text

| Table | Column searched | Count |
| --- | --- | --- |
| patient_appointments | reason, decline_reason | 119 |
| hospital_notifications | message (created by triggers from `[E2E]` bookings) | 45 |
| user_notifications | message (created by triggers from `[E2E]` bookings) | 27 |
| patients | first_name (`[E2E] Ada`) | 14 |
| hospital_referrals | reason, referred_to_hospital | 9 |
| pharmacy_inventory | drug_name | 8 |
| consultation_treatment_items | drug_name | 7 |
| consultations | provisional_diagnosis | 7 |
| hospital_wards | ward_name | 7 |
| patient_letters | title, body | 7 |
| emr_entries | title | 6 |
| hospital_billing | description | 6 |
| insurance_claims | insurance_provider | 6 |
| lab_result_tests | test_name | 6 |
| prescriptions | drug_name | 6 |
| surgery_records | procedure_name | 5 |
| hospital_staff_invites | first_name (invites the test didn't get to cancel) | 2 |

### patient_appointments (119)

00f9f045-359c-464a-9673-e9724822cb4c, 01cea7e8-3ab7-4526-8879-73e41c4f6061, 03a2d227-af78-4e76-aa24-cde4fe2563ea, 05aebb9b-801a-44bb-934a-02c36c839850, 07468ffb-02d4-4596-b2b2-8fd7f165cdc0, 07a35c88-8bee-4f91-b862-181eff85ceac, 090c5f03-7196-4c99-bb5d-1f78e327d8f5, 0badf595-fafd-46d2-be0e-93dc33a8656e, 103a3f5a-21c0-47e2-a122-3686ef519452, 11dc7b7d-044e-4d9e-ac9b-433acca9fef3, 11e156a3-7096-4e33-bce0-1e5ce412886c, 12d24961-5eb5-4efa-9c39-4cbac0549e88, 148d2cad-8803-4092-9f12-30099f1bdae7, 1615e0ce-4b1d-47fb-88d2-4fc9bd7e7e3f, 163776df-8d0c-4dbd-960e-be41fd2d320e, 16f57d91-063d-421c-95d7-1e2eb0573afe, 1d39d42d-e431-475b-afe5-d9da4bc58044, 1f7f0cec-dc1f-4c76-8c8c-4093f2a44550, 22f6345d-092f-407b-9cb4-d182732d9d9e, 2789d010-ddd8-4534-88e9-1378ac006297, 2be84c9e-7fab-41a2-a0f4-55c5e8f1597f, 2cca92bd-d2e8-4612-987c-833f30fb12f5, 2cd06ea8-4a07-4f18-99ab-9dcdc303d126, 2cf56aa1-47e2-4dc8-975e-ba67762034c4, 33e61c1e-a51b-459b-9d6d-9307509ab1e4, 34cdd002-a089-47d7-8543-3c45b4f8d129, 3748bd3f-3718-4c51-ab2b-bbe8d0ff654d, 3c6c76b9-e5ca-43d3-9dcd-b992d66be668, 3cad9e53-90ea-41b6-bec4-3539e7a0511d, 3d76d700-e507-4121-a3b0-e25dcc39cae4, 3fe96bec-aebd-49d0-9974-25f7f20f0e50, 4007e9e5-7ff3-4275-9a9e-b9298698d59a, 4057a4ae-cd35-45b3-a526-c7e3d83f42bd, 40b2776a-f91d-4396-9a05-5239796d89eb, 40fefe48-54d6-4367-9472-cbed2de02bc4, 4123d6f0-7958-4b3c-8f5f-f501fd93bed5, 42f6932f-c0c2-4f69-a80d-48494ac29028, 4655300a-438e-4549-80e7-35f045fd4475, 487d6df7-07a4-40b9-bf49-96722d5769f7, 4a5ab8b3-d102-4abd-95c6-73069a650887, 4bfe0a63-59f2-49ee-8d73-431f9d2b719f, 4d0643bc-8429-4137-af11-f37302d9ae63, 54405e42-a251-4660-afad-e35a36a174fd, 54956dce-6dd8-4f30-9bb0-afaa3c42d689, 55b31571-4530-477c-ad38-372427ec8460, 56f01cfd-522d-4e7b-9be4-9ef8e7391de7, 5b37dab6-2ccd-47e7-9109-0b8cc896387b, 5c168385-a403-4c0a-8771-a088f26b0f78, 61dbc8cd-5a86-4b0c-a696-55388faedb75, 6254c12c-a6f2-4f8b-8dec-2567bf6b61e6, 65737595-3f2f-4b5a-8679-3a1bca6cac61, 662e36e5-6e1e-47ce-9389-132152c7f0ca, 66b69173-a14e-4532-ab8c-e076e0d5fe29, 6c052aae-a92d-44d7-9e33-43485fff0150, 6cc15d51-2bee-451e-9908-bd2ef7124bbf, 6cc9734b-8305-4866-9c9f-7d3d9761049f, 71d935fd-72bc-411b-91cd-4fb52d6404d9, 74890d75-28d0-4985-a6c5-f54888ff7165, 76157787-5490-435a-9226-9ecc9a8fedc5, 76b7e71c-8c20-4a46-a32f-5658470a263b, 76e5d056-1d99-46ec-aae9-62332a499b05, 774c2921-1074-4e50-91c6-c3bc2a18826a, 77656c6c-b3e4-4be9-841f-988dce668f19, 7bbc6a8d-9f3a-4ab6-bdea-bd08d39db26a, 7f13fc34-3ec1-4af3-88bf-55aff8298a90, 7fa969fa-2992-4d9f-9e9d-ddc2f35bdf2b, 863ebce0-468d-46a5-8723-eef0b59800a2, 9130242f-1e48-4fc9-9604-1c7b2d68f06a, 9379f01c-0d6f-47a2-863e-ea34a3b8d899, 9383dee5-8f0a-4e32-bd18-d6dfd558617a, 974fd906-c570-4226-80cf-3fe51fc33488, 9965e392-64dd-4add-be12-2cc975f68703, 9e3bcd4d-acdc-4c79-8f86-125f451fd25c, a042c317-ccb3-4070-b031-581eac722314, a16d52af-f058-4564-9f3f-dda014ff767a, a4247bf6-b93b-4648-a5cf-e3820ba587f7, a5d8beff-1668-4cea-acdc-8bccc08ddcb0, a6121f39-7c97-4427-9bf3-3a13267222bb, a6388263-bcc1-4e00-978f-5d3f3dd75df0, a8deb687-9b33-40ad-9bfd-4ed7a6547b93, a9cf6d21-b404-48f2-990d-4e3062eba88b, b61db4c4-9087-4c8d-9d20-fc2e1bc17fb6, b63211b3-fa49-4d30-807b-ac809b1b01a9, b810a81a-ec10-4a5f-8f39-4821b779067e, b9947689-e66a-43ed-ab6f-fa4e0bc19055, ba307aa7-2f3e-486d-97d0-ff98f2224084, bb599696-c595-488d-8836-8f95f6e49483, be160e03-72fe-4356-a319-bcabb7ce46e2, c17ddf8f-f88f-4d72-b4c6-81512e39dd26, c23680f0-16c2-4cb6-86b1-1dd94a3ad963, c2b743d6-184c-4c79-9959-c5b7c9d2992f, c5e9a83a-2882-40df-be45-ce6736c10145, c75ca262-e046-4945-8988-901dd84a6332, c914a6fe-aea4-4405-938b-4d6c4c827cf4, c95eccfc-1075-4bea-8f7e-b0debb522901, ca1a8274-86ba-4c22-9469-61d87168175e, ca8cb623-0e75-408f-9e94-9c19f1263027, cd05d76b-741e-472b-ba16-3ba062420736, cd0d25f7-9acb-4671-8c51-92b1e4c4b1ea, cd610d89-c62b-478c-a853-8d059f736863, d0f8e49e-521b-46cf-8996-fd6061346f12, d2f20ab8-972a-4c80-bb8f-425a60d8bcbc, d88181b4-580c-4ce1-8b50-1f2ff9c72bda, deb3e285-7419-410f-a267-e298b1fb3612, e3f5b2f7-024b-47cd-94ee-d69dccfec24a, e49713aa-64da-42da-a831-fddb31333e59, e574cf51-643c-42b0-b866-b6cfc690b583, eeb9651b-c5e1-43c8-8dec-a83be2cdf788, ef534f09-a7dd-4614-8c87-ab6b3470e768, ef9d8cec-0b2a-4a7f-bfc8-4f8c32f13eef, f0a92736-00c1-4abf-9b7f-a612724d5caa, f14aa043-ed3a-41b2-817c-cc3ea8ec84e3, f3aeea75-b81b-4cda-8035-676cca0d26b5, f47b4c38-8126-4044-a8ea-557bf3641ef3, f63fd67f-6c5d-4314-be23-add999e65a3d, f9528437-462e-4efb-b48a-33808b05c2b7, f9822acf-ccb0-4033-8e3a-84b7b15b8553, f9f0de39-eb5a-4794-9a39-a0685a551e3a, fd8909dd-6c45-4742-b22e-df9cd14f18a7

### hospital_notifications (45)

08855107-b902-4440-81ca-a147f6979bb4, 18b61f1b-7102-492d-bdbd-21ee8ea13f2e, 20407143-ce34-463f-a0bd-655f647dad06, 2cc1d90b-1e18-40c4-8f90-9447d3e16260, 3a1075f5-a13b-4997-9f7e-55e153c56cf2, 3f7a0301-d088-475f-9ecd-91ba3b6459c7, 3ff4674f-91fd-4360-932d-0850fd839190, 4a29b01d-69e6-435a-9d31-61b7fc93a682, 4a55e116-1821-4bda-ad3b-80f73760266d, 551e337e-41ee-4d3e-aa43-b7ad240a9d2d, 57340b1b-d25c-4e51-860d-36d0920bb060, 5e207704-f450-42d6-96c5-edf6c1692bbd, 5e2268e2-c557-4652-8158-7025f17ae32c, 6309dec9-2eb9-4999-beb4-6363d9415aef, 632a9995-b102-4bd8-92f2-2859e0c19396, 700e6e3d-6ad2-4ca4-baf3-15d4bc5706d6, 743fcc11-af01-40d2-95a2-71500841a1ec, 75e1cf15-bb0d-4ac4-85dc-0e13a1248185, 7ab2f2f6-339c-4631-81b7-cdba4a1abeed, 7eec3a9a-cdd2-4a56-9ded-dddca809d0fa, 89be5a81-a83b-4311-a80f-b0de100f2e64, 8b9f80e6-b837-460c-9d7d-db7e764355ee, a408bf15-cc50-4733-b5f7-6bf36da94a4d, a49581b5-ecf1-4838-b8df-0d159f83d087, a55a86c3-82e2-4a5b-b988-b90d02b7563c, a6a3639b-7a4d-41bb-a064-79c147226870, acc21b31-bedd-4d31-860a-883ab7177574, b02b004b-2fbd-4991-9c6e-6cee3450eb89, b7008aec-bbca-4a62-8f6c-a7c26dcf0901, b841773c-6d78-4229-9bc0-0a4ee9273f31, bd16607c-907e-497c-abaf-7725bb097104, bd4de02e-084f-4977-b1e6-8dab1b6235fc, bfe87b11-48f6-4f02-b6e1-1e2d53ccf270, c3605202-7eda-4f18-8f95-716fbcad310b, c974d49a-4a72-45a9-a840-3d481b185b9b, d09fde90-342e-4055-bd1e-18dd302aa211, d1bd3b61-3b4d-42b4-a474-3c553a602c9e, d98d8903-2881-40b8-8ba7-d29efe51678f, e60389d2-8c34-4763-886b-e55907cb99e7, e92bb145-4c17-4dc4-9009-51b9e5b8279c, eb1dd59f-4f39-4841-a4d5-b0eb5b4046a2, ef130058-1a59-4d6c-aa27-02ca100e77dd, fc6579a2-85d8-4677-bcd1-107f5ef362e8, fd337b88-444f-4614-84d5-0cb59c43d168, ffceb1c7-d0ed-4363-9c75-6637b721e9e1

### user_notifications (27)

019e7ec1-2281-4be7-8e8f-b8fc68493376, 03b1f7c4-5f5b-4194-bacd-ec3dbc6295c9, 0a522851-2737-4e7f-9bb7-cb4a4df691ad, 1c4de983-d160-41e6-9849-ca44d6b2be5c, 22b91ecb-c1ab-452e-931a-ccedcf3694ae, 2e0d1987-d3d7-4a9d-892a-02def298baa4, 49850e21-9c1d-4aac-a6ff-81d8bc903c09, 4c2eb947-1c44-49cc-9832-86b620075850, 534b9737-f790-46c5-aaa7-8675bf77fb05, 58e760ac-4cd6-4849-b61c-7cfbb8587c5e, 6a2038b6-ddfa-42b5-bea4-d37a79c73f4a, 6c130f1a-0c34-4114-9344-927a00ddaa18, 703b018c-2d23-4d49-8704-cae96b1be963, 71eebdfe-33a7-4755-8ec1-f77e6ff71008, 765dd0fb-8154-4841-b5d2-24c4f7eb0b6a, 783b3a72-7982-4c26-8fb9-22831a37484b, 8820f2ac-562e-4f82-b2c7-c065a4dfb91a, b276edc6-5178-404d-a041-2658a1219441, b6ae2a6c-5220-4d4c-bdbc-6495ec5064e7, c8b671fb-5141-47fa-b445-f3a8ee72f390, ca244627-9a39-477f-82f3-26cab71f526e, d9237bee-d85b-4173-9c0c-bef1b7c98711, db2e3031-212a-4aab-8ffe-b7992f85bc91, dbf9485d-0b94-46ca-92d8-84e1269eed36, f25a6e19-01ee-44bc-b6c9-9e05fe61f9f5, f358e316-d4b3-48b9-9eac-8ea914978a16, fec21b18-2e37-4099-88b1-5ccc7b81d132

### patients (14, all named "[E2E] Ada Okafor …")

0dcd9d62-bd5a-4026-ad7d-c1d901955754, 1071cd62-f2b9-4a39-b78d-d0f9b9d9c28b, 16229565-b88a-4a93-bfe5-85d7481416cf, 46d7380c-6777-4191-a649-c9bbacc51168, 63c2ca45-31a6-474d-83ae-bc3bb788d099, 68eb8430-1be8-4a96-bc89-be0875feef5d, 7d4c1bc3-f8ce-41b9-be70-7d119d1637a4, 813e4cec-8f8b-4daa-a0ab-c595ee5fc5ca, 9bb26830-056c-4b00-ac3f-cac3edfe0856, 9e87e98d-4eb3-480a-9ef8-974640becf84, a280a141-5b65-4d9b-812f-fd62bc213358, bcefb2e5-e60b-48ce-bf42-145fe979538b, c50cc20b-a834-45a6-b596-a8175f85f836, cc7b12a8-9b61-4315-bd6b-99162ba787e9

Each also has one `hospital_patients` link (14 in all; that table has no `id`, so delete by `patient_id`).

### hospital_referrals (9)

44d93b4c-6771-4d8c-af25-fad70b4709bf, 751e5be8-d158-4b3f-86e0-2028e6cd20b3, 83b0c307-53de-455b-94bd-d987c6e72cb9, 8931c756-d913-4e44-a188-bab8ff07c141, 96cab3b7-2f45-429b-9642-d613532d7e8e, a42880a9-b3f2-4162-9de5-1406ed071fae, abd1e20e-415f-4e5b-b33a-3d592f4df1cc, d6d8fed2-4cd0-4c5a-b955-381616f9f087, f35db715-ca58-4402-b19f-68f4f1112c58

### pharmacy_inventory (8)

1df6ebac-2911-463b-92cb-7a2b0728c9ea, 67214b2f-102c-4088-8248-b9b0e361dfb4, 7fe06745-a003-45b0-a8b5-e6e7c59aa58b, 8306f7cf-ff0e-48a7-9b34-8f230a13dcd7, ae4229d0-9f6a-4b3b-9df6-931c9f27df0e, b4837dfb-9c0f-4dce-8d52-c257531364cb, ccdfac5f-4293-42a7-9605-4063f1d950e8, ef3118ba-dc3d-4140-a651-188b00b76ca5

### consultations (7) and their treatment items (7) and prescriptions (6)

consultations: 6e903735-9979-4305-875e-e9ff8d16afd1, 87c4ce05-f9e5-46d3-9d16-43c5b50a9f5e, 905cf7a3-3582-4e7c-b4d4-207c0175e412, 940c0029-0593-4394-8153-c467a9d7e9d4, 9bc8df2a-bae9-4ff9-bf77-41f5c3a63c28, d5319ea7-ef4e-43fd-a263-543570be7177, dd869280-7095-40f9-a74e-9a6e061cdb11

consultation_treatment_items: 19152015-d792-49c4-952f-f31a792eb5c6, 3d6dde26-f21f-438e-b0c2-2e7810ca1964, 4e8bdcaf-2286-4953-ae1c-cccb105cb756, 5d0df1d7-aef9-4934-8413-fd64331ffccc, 6ac0ffd4-4328-4bf7-a371-954fe6579761, 72351936-3c36-44fa-840c-c24f6da5f70c, f6674adb-6229-4fd0-9c8f-9910a04e5a4d

prescriptions: 0d377445-0160-432c-998e-27549f0a206b, 1ab7bb0f-0bc5-44d3-a041-679de0457270, 302f2666-7c88-4713-82c3-fe845d4dbdf7, 78291370-2c00-4fae-8824-8141129615f5, 7eb72cc1-3dee-4420-8df7-80f59bc241e3, ac34a7ef-c3bc-4e7e-ae7b-264cf6040f1a

The FBC lab orders made from these consultations use the catalog name, not `[E2E]`; find them by `consultation_id` in the consultations above.

### hospital_wards (7)

0e26e0ad-8e12-412a-974e-203442067238, 1400ace0-59c0-4018-affc-a4241504b5fa, 36838066-3977-4270-aac4-6cd2888cf616, 4787ee98-a8cf-4e0c-bd0a-a600c605a300, 72a26a51-9942-4c0d-8977-aa175a58f622, ba9f4cfa-1ad6-40f2-8751-3e8b4efafe23, c89c5031-ab5b-4494-8237-74ff3aaf5dc8

### patient_letters (7)

1d5a7561-44ec-4e91-b712-818c9171e6a7, 21ee90dc-099c-412e-9cb6-179479aad3d2, 253d669b-4a29-4b3e-b62b-e3294f3fd1b2, 26c28f87-edf5-42a3-bddb-817426c2c161, 80808142-6c2a-4143-a1da-f5b61f9a4357, cac3aede-d8e9-4ef6-8b5a-a22a88553ba9, dd50ddb9-0b2d-43e7-9947-ab6386f18d1a

### emr_entries (6)

27b95d9b-4c34-4390-8e3c-1b80899ca112, 62e0a701-d0fb-4aba-8fe2-0498cbe61c29, cb73c539-9164-4fcc-9580-f8a941c66f7a, e42465e5-efcb-469d-9abd-287693d626ec, e49cbf8c-c072-4219-8e06-45edee607d1f, fe3cdf46-6f5a-4ec1-a00b-19e17805ed35

### hospital_billing (6)

1a3d3d00-8a10-41c3-abe3-a67dfb506110, 3290dcf6-7650-4c1c-9a32-0f3648c92855, 9e19da7c-9336-44c1-a7e5-8dd56603344b, b400b2a4-b951-45c3-9009-07deeb3df394, bb91cbde-5916-4c56-a855-e64dedd07354, dd068531-1fef-4406-9c12-e179f4c0b426

### insurance_claims (6)

7ea71ff2-1a96-487e-8736-587e209da7f8, a669b838-7714-4b74-86e2-8f985649ed57, b227c2e1-5a99-460f-893d-7930de2adac3, e8a1d469-c0d2-4c40-b933-3709c53e5167, f1d157fe-0a65-4cca-b04c-aeaa28a341b2, f969a928-a7e6-4312-9281-b06373069fe6

### lab_result_tests (6) and their lab_results orders (6)

lab_result_tests: 45bf8623-81d6-42a6-a28a-556f0c8659d8, 4bd65899-0e09-4045-9661-9f83a6fa30ab, b9b3dcaf-2bf0-4de0-bfc8-d6a4254568d9, c1ca86ee-c97d-44ca-a725-fbf539833f12, e332be30-6458-48cf-9313-9f1b3b868950, e3700f32-fd3c-4a1d-8806-5550b8c320ba

lab_results: 1f615f52-a5df-444e-870e-718b08b43092, 479cbf71-c542-4a60-9db2-f0ad64321221, 4da17390-721f-46cc-b3d3-3cfd06dacc59, 74ad0859-e0fb-44d4-b9df-a46a01bef44b, 8bfedda0-4137-4f66-a125-df5a8dde2010, a25e709e-458d-4613-a460-24b80a16a7bd

### surgery_records (5)

106953ef-9863-42e7-a9e7-5d9c75b56b19, 2570aed3-8a63-40e5-9589-2ab8ffd16d1d, 2639c6ed-a6ee-47a1-84d8-6cb10cfb583d, 2c2eabea-f6a3-4f55-8ef0-b222c7567ac3, c2afbd55-5e84-426e-b96b-7db53dd0491f

### hospital_staff_invites (2)

8aeeb1c6-e46b-44e7-8a5a-760773f85512, bd2bddc9-4402-4c39-ba86-bd010c74bae0

## Linked rows without `[E2E]` text

### patient_checkins (6, for `[E2E]` patients)

133f841a-0659-4110-8ba5-74dfebbda3d9, 2d7cc6f1-79d0-4022-b41b-c26657850c70, 68f5970e-0c5d-4803-84b8-0124e24efa84, 766e5ec5-10f9-4f38-861f-7a54a6646325, aacfc896-cfc5-4341-9a65-e2ed5caf3300, bf4b6151-daa4-4453-8889-284914635d3c

### maternity_records (14, for `[E2E]` patients)

0c824a95-bcc7-41cc-924d-54a81a25dc56, 245fe345-ee67-4896-9cc0-f76c92401faa, 2f550b31-795b-42de-b525-c613b1c3e698, 361dbecb-eaa3-47d0-b38c-1b4d63cf638c, 36fbaa95-3e7f-4c67-9557-5d3496d3eb1d, 40fcd3e4-38c5-4575-b70a-429423a8ca60, 4da5c6e5-ee64-411d-9d4a-884dff7fceb8, 5d1dff75-e2df-4952-8bc3-63be76204ee4, 9347af94-68ad-468d-b1f3-db71c00f50c3, 93f80004-11d0-42fe-b24d-3bc11116e5da, 9793a71b-88b3-4ee0-bf5b-f98db52ffd7d, b3f76f4a-734e-49e8-95ef-f70edfcf52e7, cf595cef-ad7e-46f4-b745-45c48908e422, e0804b04-866e-4832-acd3-5b6e80d40c14

### Made by the test patient account (no `[E2E]` text possible)

- **patient_share_codes:** single-use 15-minute codes, now expired or used: 5AZPY9, AJEKFS, GHQ94R, K7WAQE, KXUXKS, MDBDPR, PY4TFV, QJ5F55, XMGAHE (from the run ledger; earlier runs' codes weren't recorded).
- **triage_sessions:** one per triage run by the test patient. They hold no `[E2E]` text; find them by the test patient's `patient_id` and today's date.
- **Storage, `avatars` bucket:** test avatars under the test patient's folder `5d159e4e-a06f-475b-8ae2-6559c403bff7/` (`avatar-1793274585454.png`, `avatar-1793332433882.png`, `avatar-1793332520332.png`, `avatar-1793333437941.png`, `avatar-1793333524113.png`, plus any from earlier runs). The newest one is the account's current photo.

---

## Pharmacy network runs (2026-11-04)

From the run ledger (`e2e/results/created.jsonl`) for every run in this round: pharmacy spec passes 1, 2 and final, the public-tests run, and the first run of the other four specs on the new code. Nothing has been deleted.

Delete children before parents: `pharmacy_fees`, `pharmacy_reviews` and `rx_dispenses` before `rx_pharmacy_requests`; `medicine_checks` and `rx_dispenses` before `prescriptions`; `prescriptions` and `rx_pharmacy_requests` before `rx_documents`. `rx_access_log` rows (one per pharmacy view or dispense of these documents) go with their `rx_documents` row (on delete cascade).

Also created by triggers or functions, with no id in the ledger:

- **user_notifications:** "Prescription dispensed" and pharmacy-reply notifications to the test patient; "New prescription request" notifications to the test pharmacy. Find them by `reference_id` = the documents and requests below.
- **rx_access_log:** every pharmacy view and dispense of the documents below.
- **doctors (test doctor):** `practice_address` (`[E2E] 12 Ikot Ekpene Road, Uyo …`) and `signature_data` were set by the spec. Keep them; the doctor needs a signature to issue valid prescriptions.

### prescriptions (26)

| id | note |
| --- | --- |
| 8c12d1ef-6a0f-4a22-92be-569df7ebf4dd | [E2E] Amoxicillin 500mg p1am |
| 1f3a1317-a2fd-4d03-870a-1af8045cca34 | [E2E] Lisinopril 10mg p1am |
| 48e68ca0-e3bd-40d1-b76f-cad29f7137a4 | [E2E] Amoxicillin 500mg p2ad |
| 94dc54eb-619f-42a4-ab30-c77ea4b7e694 | [E2E] Lisinopril 10mg p2ad |
| 22813154-a873-4b00-8fd6-220cc3776978 | [E2E] Metformin 500mg p2ad |
| 8ef19d66-fb7b-4281-bff5-967d9fc7eb75 | [E2E] Omeprazole 20mg p2ad |
| 0162ef58-8eff-4ca6-a468-2da19f014732 | [E2E] Ibuprofen 400mg p2ad (entered by hospital staff) |
| 2b9a9529-1164-4eb4-af63-c4050b391205 | [E2E] Amoxicillin 500mg p2am |
| 96c87491-f5fd-49bc-99b3-85428764aadc | [E2E] Lisinopril 10mg p2am |
| 95711771-daef-4e48-9da9-1090717a775e | [E2E] Metformin 500mg p2am |
| 0d93232c-59ea-43c5-bed8-b5025e50393c | [E2E] Omeprazole 20mg p2am |
| 5f37bfd4-fbe1-43a5-838d-1e483ea010b6 | [E2E] Ibuprofen 400mg p2am (entered by hospital staff) |
| 878c19b4-495c-4a86-80fa-2b35aaab3338 | [E2E] Cetirizine 10mg p3ad |
| fdfc8de7-f7db-4a20-b5d8-419dd671b2eb | [E2E] Cetirizine 10mg p3am |
| bdd5f59e-6d64-4499-8aa8-030c0fa99a88 | [E2E] Amoxicillin 500mg p4ad |
| cfa5308e-ab08-49bb-ab97-d55f69372db2 | [E2E] Lisinopril 10mg p4ad |
| 7280c9d1-4239-4943-a90d-793f0666dd8b | [E2E] Metformin 500mg p4ad |
| ba743917-e1f5-40d0-9c01-781ec0139387 | [E2E] Omeprazole 20mg p4ad |
| f65ce799-0494-40a3-a6c6-5ea88a44a0fc | [E2E] Ibuprofen 400mg p4ad (entered by hospital staff) |
| c4757a10-7954-45f7-ab65-8d4d66ff5ae2 | [E2E] Cetirizine 10mg p4ad |
| e21d2436-24e7-4019-8483-9f8969bfd195 | [E2E] Amoxicillin 500mg p4am |
| 60f853ff-6c36-468f-aea4-0da3630bb35b | [E2E] Lisinopril 10mg p4am |
| ea50498e-f6cb-4da5-92ab-c97ae5f0abf7 | [E2E] Metformin 500mg p4am |
| 2fee9e8f-eb87-4367-8e23-4fb44ed2910b | [E2E] Omeprazole 20mg p4am |
| 152b302c-6ac6-41e6-897f-e20f06bcadac | [E2E] Ibuprofen 400mg p4am (entered by hospital staff) |
| 2d1cdfff-20be-41fe-89ea-975730b3e62c | [E2E] Cetirizine 10mg p4am |

### rx_documents (26)

| id | note |
| --- | --- |
| 0fdb3dcd-65b4-45d1-a618-177ac26670fb | [E2E] Amoxicillin 500mg p1am (HN-2RSCG-04ARX) |
| 8eb4f814-460e-4b36-9bbf-1e6d19260498 | [E2E] Lisinopril 10mg p1am (HN-DX27Q-MP3FR) |
| 6d9f6d6c-c927-4397-81fc-17a9c0932c27 | [E2E] Amoxicillin 500mg p2ad (HN-HFPM2-RYFWY) |
| a20c4c33-ac28-4753-bb76-0dcbfa52890f | [E2E] Lisinopril 10mg p2ad (HN-40B8V-QSBZ9) |
| ef9929b3-3e6f-49dd-846f-b4ccabf8cf49 | [E2E] Metformin 500mg p2ad (HN-DFV4H-2DT88) |
| db22d879-ad2b-4e25-84ea-3ae2cff254c5 | [E2E] Omeprazole 20mg p2ad (HN-YN647-JTB50) |
| 1abb0cac-86c4-4e89-b98a-8eb110bd1563 | [E2E] Ibuprofen 400mg p2ad (HN-DCYG5-Y91EE) |
| e24454cf-d758-44d1-a71b-d944d274edba | [E2E] Amoxicillin 500mg p2am (HN-T71NS-2A1VE) |
| 130a6c6c-d29a-4326-b027-59f04f98cd0d | [E2E] Lisinopril 10mg p2am (HN-KRZ1Y-TRMJ2) |
| 5e532acf-3c8b-4c78-9234-61f3176b47bf | [E2E] Metformin 500mg p2am (HN-08ZYQ-PXBZR) |
| 0feeeb80-b012-439e-85c7-acb533c4d710 | [E2E] Omeprazole 20mg p2am (HN-VC9JG-DNDSB) |
| 792b5678-dce9-4bdf-8aa8-359b4d7b3279 | [E2E] Ibuprofen 400mg p2am (HN-22822-9TK2P) |
| f959cd73-bcae-44eb-9630-043a0ec18b0b | [E2E] Cetirizine 10mg p3ad (HN-VZ6KN-FZ3ND) |
| 3ee82164-784d-4f44-a11e-ddef55c38fc7 | [E2E] Cetirizine 10mg p3am (HN-PPD49-PNWVY) |
| 4aaf93c0-aa32-45b2-8c53-6ecd3f388965 | [E2E] Amoxicillin 500mg p4ad (HN-ETP2B-NAMJW) |
| e43e9a73-3223-4d05-b8a6-06c0598e5a5c | [E2E] Lisinopril 10mg p4ad (HN-BD5VJ-4ZJN2) |
| be9f05da-6e57-4fc5-b7f0-f5fd6aedfa05 | [E2E] Metformin 500mg p4ad (HN-4N1HD-JVVXC) |
| 0816b85f-1f7a-41e0-a2c2-f45d1ce019c9 | [E2E] Omeprazole 20mg p4ad (HN-SEW4H-87CTV) |
| eae44582-267b-4462-8f94-05857d5f1597 | [E2E] Ibuprofen 400mg p4ad (HN-KNQD4-G965Z) |
| 5662979a-55da-44cd-81bf-1586a971c8c2 | [E2E] Cetirizine 10mg p4ad (HN-C328B-W805K) |
| 73775dea-ebb5-4a10-b2d4-e9b10131445a | [E2E] Amoxicillin 500mg p4am (HN-30WXS-2BJWE) |
| 93feaa12-c49b-4c35-b3e9-13786726b6f5 | [E2E] Lisinopril 10mg p4am (HN-ETR2Z-RR2YH) |
| cca31e93-a42e-4355-9dff-0fde3d4db783 | [E2E] Metformin 500mg p4am (HN-XV3HK-CAZ4M) |
| cb6d5e49-719d-4fc0-92ba-e1ca20a6275b | [E2E] Omeprazole 20mg p4am (HN-HDN06-B1MAZ) |
| 88af9c8c-165e-4879-b269-986648fe928c | [E2E] Ibuprofen 400mg p4am (HN-D8A90-GTRCC) |
| a1096228-b213-466e-b31c-ff99fd1e42fd | [E2E] Cetirizine 10mg p4am (HN-43YQ4-4K323) |

### rx_dispenses (17)

| id | note |
| --- | --- |
| 05f1be5c-98bb-42b2-b49d-bf729aea8c31 | [E2E] Amoxicillin 500mg p1am (HN-2RSCG-04ARX) |
| 75d514c3-0493-42a3-81d3-ca9b11320468 | [E2E] Amoxicillin 500mg p2ad (HN-HFPM2-RYFWY) |
| 6a3bc26d-d241-471a-9310-dfe7f798d6d9 | [E2E] Lisinopril 10mg p2ad (HN-40B8V-QSBZ9) |
| 5899b2ed-d44c-410f-a352-37f1418396c2 | [E2E] Lisinopril 10mg p2ad (HN-40B8V-QSBZ9) |
| a5c36e9c-8ff6-483f-92ea-9a72a6e9cd4a | [E2E] Metformin 500mg p2ad (HN-DFV4H-2DT88) |
| 236c4165-3188-45a2-ad0d-4de1c3bf327e | [E2E] Amoxicillin 500mg p2am (HN-T71NS-2A1VE) |
| 79b8d385-8c40-4e9f-894a-1e495c262642 | [E2E] Lisinopril 10mg p2am (HN-KRZ1Y-TRMJ2) |
| f48a57bc-ee60-4ed5-9d82-d50546606ae3 | [E2E] Lisinopril 10mg p2am (HN-KRZ1Y-TRMJ2) |
| 21dba10e-aadb-42fe-b811-ab42f45f7a6c | [E2E] Metformin 500mg p2am (HN-08ZYQ-PXBZR) |
| 26e71172-09e1-4ac0-9e3f-2b6cfe87e0a7 | [E2E] Amoxicillin 500mg p4ad (HN-ETP2B-NAMJW) |
| 4acdd791-d9e3-4221-9ed5-824844957552 | [E2E] Lisinopril 10mg p4ad (HN-BD5VJ-4ZJN2) |
| 1d780a41-5842-4e03-b151-5fede060013b | [E2E] Lisinopril 10mg p4ad (HN-BD5VJ-4ZJN2) |
| 83fc49fd-5121-4b6e-bb1d-df9de810fbb2 | [E2E] Metformin 500mg p4ad (HN-4N1HD-JVVXC) |
| 39057fc1-c959-497d-95b7-e9478f32784d | [E2E] Amoxicillin 500mg p4am (HN-30WXS-2BJWE) |
| edc938b6-9594-488a-8ca0-2b7585192b39 | [E2E] Lisinopril 10mg p4am (HN-ETR2Z-RR2YH) |
| 93ad77b5-afc4-411e-80bc-5ade52453eba | [E2E] Lisinopril 10mg p4am (HN-ETR2Z-RR2YH) |
| 599bbf87-4ca4-4ccf-a482-6e5f571cc7b3 | [E2E] Metformin 500mg p4am (HN-XV3HK-CAZ4M) |

### rx_pharmacy_requests (8)

| id | note |
| --- | --- |
| 569d52c9-7733-427a-bbc0-062b7e97b6af | [E2E] I will pick up after work p2ad |
| b284b585-8702-43f9-81e3-f74a0953aa38 | [E2E] Please hold until Friday p2ad |
| f85166ab-7637-4ac0-a101-f5409d21c8f9 | [E2E] I will pick up after work p2am |
| 285275e5-faf5-4f60-87aa-5d288018cfbc | [E2E] Please hold until Friday p2am |
| d5f7baa7-6dcc-45a5-aa9c-4d54f00861a9 | [E2E] I will pick up after work p4ad |
| e3f2655e-6293-4553-8060-3c4a994b351e | [E2E] Please hold until Friday p4ad |
| 9e8d3747-3c16-4a55-b450-cf327ae64352 | [E2E] I will pick up after work p4am |
| 3bf2bcde-dba8-4392-8a33-176cedc27cef | [E2E] Please hold until Friday p4am |

### pharmacy_fees (4)

| id | note |
| --- | --- |
| 364dd4e9-d108-4142-8ff8-b1c00c6dc7c5 | fee for request 569d52c9-7733-427a-bbc0-062b7e97b6af |
| 4c9082ce-745b-40b7-abec-0f94c26abccb | fee for request f85166ab-7637-4ac0-a101-f5409d21c8f9 |
| 146fcbce-0e6a-4e69-8209-a1ceeef07dd0 | fee for request d5f7baa7-6dcc-45a5-aa9c-4d54f00861a9 |
| a6b1358a-eafc-427e-824d-0be6d8cff02a | fee for request 9e8d3747-3c16-4a55-b450-cf327ae64352 |

### pharmacy_reviews (4)

| id | note |
| --- | --- |
| 569d52c9-7733-427a-bbc0-062b7e97b6af | 4-star rating (row keyed by request_id) |
| f85166ab-7637-4ac0-a101-f5409d21c8f9 | 4-star rating (row keyed by request_id) |
| d5f7baa7-6dcc-45a5-aa9c-4d54f00861a9 | 4-star rating (row keyed by request_id) |
| 9e8d3747-3c16-4a55-b450-cf327ae64352 | 4-star rating (row keyed by request_id) |

### medicine_checks (8)

| id | note |
| --- | --- |
| 70389b86-c368-4358-b834-168b7e6635aa | genuine for prescription 48e68ca0-e3bd-40d1-b76f-cad29f7137a4 |
| 9b84ebd9-1faa-4c5b-9f89-ba1076dfd86e | not_found for prescription 94dc54eb-619f-42a4-ab30-c77ea4b7e694 |
| 885eb5d4-d90d-4f18-a5f4-77252e791e52 | genuine for prescription 2b9a9529-1164-4eb4-af63-c4050b391205 |
| e36e3da9-c477-4a89-8ce0-f48024ee5fcd | not_found for prescription 96c87491-f5fd-49bc-99b3-85428764aadc |
| 1766839e-5280-42c1-a034-ec512c403e03 | genuine for prescription bdd5f59e-6d64-4499-8aa8-030c0fa99a88 |
| 0974f49d-c0c6-4cbb-9986-4ae6c427ffdf | not_found for prescription cfa5308e-ab08-49bb-ab97-d55f69372db2 |
| 0dce87dd-ce0c-4585-883e-d6b7fa9d9290 | genuine for prescription e21d2436-24e7-4019-8483-9f8969bfd195 |
| daf49b25-a8b9-4b0b-94a6-8f5a78adbda4 | not_found for prescription 60f853ff-6c36-468f-aea4-0da3630bb35b |

### pharmacy_inventory (8)

| id | note |
| --- | --- |
| 4d85e274-37a5-4e69-80bf-b140b6900954 | [E2E] Paracetamol syrup p1am |
| 123626cd-55a7-413c-a378-c4be0cd24b70 | [E2E] Paracetamol syrup p1bd |
| bfdfd441-2d39-4944-a714-50d0810af833 | [E2E] Paracetamol syrup p2ad |
| af20b89c-50e6-4c42-bdd0-656c03e09e7e | [E2E] Paracetamol syrup p2am |
| (not found) | [E2E] Test drug x1ho (find by the [E2E] text and run x1ho) |
| (not found) | [E2E] Test drug x1ho (find by the [E2E] text and run x1ho) |
| 3bbb1c81-d6e7-4f37-b16b-76d19abb937b | [E2E] Paracetamol syrup p4ad |
| 8b97eec7-093a-4ed0-8e80-4c940895be41 | [E2E] Paracetamol syrup p4am |

### anc_records (2)

| id | note |
| --- | --- |
| (not found) | [E2E] ANC record for the run's [E2E] patient (find by the [E2E] text and run x1ho) |
| (not found) | [E2E] ANC record for the run's [E2E] patient (find by the [E2E] text and run x1ho) |

### consultations (2)

| id | note |
| --- | --- |
| 5fcf81a5-5fa7-4590-b670-71a970710582 | for appointment f2dedc4c-b0f7-4054-835d-92c684c03ce9 |
| 614ad451-6410-4406-a4c9-f605ebf8fef9 | for appointment fc67a071-16c2-4c04-8755-abd876708c17 |

### emr_entries (2)

| id | note |
| --- | --- |
| 78a0a4e0-4939-4ab0-aaaa-9e48741bf4a7 | [E2E] EMR note x1hod |
| b77a93f8-1983-4098-bf92-54fdc28899c9 | [E2E] EMR note x1hom |

### hospital_billing (2)

| id | note |
| --- | --- |
| (not found) | [E2E] Consultation fee x1ho (find by the [E2E] text and run x1ho) |
| (not found) | [E2E] Consultation fee x1ho (find by the [E2E] text and run x1ho) |

### hospital_referrals (4)

| id | note |
| --- | --- |
| d7be7cc2-f18f-42d5-98b3-4eee178e3c8e | [E2E] Doctor referral reason x1dod |
| b0445074-9c00-400f-b688-bb54e4f16db3 | [E2E] Doctor referral reason x1dom |
| (not found) | [E2E] Referral reason x1ho (find by the [E2E] text and run x1ho) |
| (not found) | [E2E] Referral reason x1ho (find by the [E2E] text and run x1ho) |

### hospital_wards (2)

| id | note |
| --- | --- |
| (not found) | [E2E] Ward x1ho (find by the [E2E] text and run x1ho) |
| (not found) | [E2E] Ward x1ho (find by the [E2E] text and run x1ho) |

### insurance_claims (2)

| id | note |
| --- | --- |
| (not found) | [E2E] Test HMO x1ho (find by the [E2E] text and run x1ho) |
| (not found) | [E2E] Test HMO x1ho (find by the [E2E] text and run x1ho) |

### lab_results (2)

| id | note |
| --- | --- |
| (not found) | [E2E] lab order (find by the [E2E] text and run x1ho) |
| (not found) | [E2E] lab order (find by the [E2E] text and run x1ho) |

### patient_appointments (26)

| id | note |
| --- | --- |
| c09eadb2-74ed-4bf2-94f6-2085201d49f1 | [E2E] Booked from triage x1pad |
| 5c314c85-14f5-483d-b2e9-c412e75db4e9 | [E2E] Booked from triage x1pam |
| 5b81f70f-ffdf-486f-8950-867359096b69 | [E2E] Doctor spec open request x1dod |
| 4b4e9a06-2487-4cb2-9ae2-4ea87a8fd378 | [E2E] Doctor spec accept x1dod |
| 4d201df1-9c31-467f-a1da-fb421595005d | [E2E] Doctor spec decline x1dod |
| f2dedc4c-b0f7-4054-835d-92c684c03ce9 | [E2E] Doctor spec consultation x1dod |
| 8369b23f-6cf8-406e-be4c-6c189f8965c8 | [E2E] Doctor spec referral x1dod |
| 8a465324-7073-4a79-9137-580b3197c0b7 | [E2E] Doctor spec open request x1dom |
| 785f0069-72c7-4485-9eb1-9d6c65967315 | [E2E] Doctor spec accept x1dom |
| 37a35e86-51e6-4eef-ad69-60e387ac2c15 | [E2E] Doctor spec decline x1dom |
| fc67a071-16c2-4c04-8755-abd876708c17 | [E2E] Doctor spec consultation x1dom |
| 11e33d1a-c2a4-4e87-b17d-efdae579b041 | [E2E] Doctor spec referral x1dom |
| f07fb5b2-e965-4e87-a9de-53a4dc6a6c4e | [E2E] Hospital spec appointments page x1hod |
| 966ae7cb-26ae-4e08-8a6e-07f693340535 | [E2E] Hospital spec appointments page x1hom |
| 9a8f2949-46c4-454d-ba58-0bf75151e282 | [E2E] Flow 1 any doctor in person x1apd |
| 431a7058-565e-4354-8923-a9baf94c2e5a | [E2E] Flow 3 hospital assigns x1apd |
| dc958c2d-2561-44ee-baef-d4f660312598 | [E2E] Flow 4 specific doctor x1apd |
| e2d7426e-265f-4677-9360-77e32f7d7de4 | [E2E] Flow 5 declined x1apd |
| 3c7793c5-33cd-4246-9966-ab264786f0ff | [E2E] Flow 6 video x1apd |
| 091e6b79-cf32-4665-b6ba-67a4adc32e62 | [E2E] Flow 7 patient cancels x1apd |
| f62ebb41-247d-4438-973a-b950d2f6eac7 | [E2E] Flow 1 any doctor in person x1apm |
| 0cd2daa0-ac18-4540-9f17-83b72e2812be | [E2E] Flow 3 hospital assigns x1apm |
| 6c938e19-97f5-4609-b9b1-0a2c6d140d7a | [E2E] Flow 4 specific doctor x1apm |
| 88764f2b-ff75-44d6-a520-be59db05f91c | [E2E] Flow 5 declined x1apm |
| bd722479-d351-4dc6-928e-e0a6fe90f65c | [E2E] Flow 6 video x1apm |
| bfab8a9a-6893-40d1-b32e-e1c8df57e7ac | [E2E] Flow 7 patient cancels x1apm |

### patient_checkins (2)

| id | note |
| --- | --- |
| 541a6a45-6484-4cb3-8add-8cc5f2f5b7bc | check-in for [E2E] Ada Okafor x1hod |
| 780dfaac-0513-4729-a28f-289726421833 | check-in for [E2E] Ada Okafor x1hom |

### patient_letters (2)

| id | note |
| --- | --- |
| 494e33e8-97ff-4282-8646-a875347f6397 | [E2E] Fitness letter x1dod |
| 139aad2b-238b-4520-8f28-b513761bb885 | [E2E] Fitness letter x1dom |

### patient_share_codes (3)

| id | note |
| --- | --- |
| S6Z3GD | share code shown to the patient (single use, 15 min) |
| EFYJ3K | share code shown to the patient (single use, 15 min) |
| KFMUUR | share code created for the hospital link test |

### patients (2)

| id | note |
| --- | --- |
| b81ba51e-5480-4901-93e1-2f6cda2b7493 | [E2E] Ada Okafor x1hod |
| d99750cf-2e22-4f7f-a2f0-8880f32c8b6f | [E2E] Ada Okafor x1hom |

### staff_invites (2)

| id | note |
| --- | --- |
| (not found) | e2e+x1hod@example.com (cancelled by the test) |
| (not found) | e2e+x1hom@example.com (cancelled by the test) |

### storage.objects (avatars) (2)

| id | note |
| --- | --- |
| https://prougveoeumxvyallkcm.supabase.co/storage/v1/object/public/avatars/5d159e4e-a06f-475b-8ae2-6559c403bff7/avatar-1793814892823.png | [E2E] test avatar uploaded for the test patient |
| https://prougveoeumxvyallkcm.supabase.co/storage/v1/object/public/avatars/5d159e4e-a06f-475b-8ae2-6559c403bff7/avatar-1793814984428.png | [E2E] test avatar uploaded for the test patient |

### surgery_records (2)

| id | note |
| --- | --- |
| (not found) | [E2E] Appendicectomy x1ho (find by the [E2E] text and run x1ho) |
| (not found) | [E2E] Appendicectomy x1ho (find by the [E2E] text and run x1ho) |

