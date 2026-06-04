/*
  97_eye_tests_patient_dob.sql
  Optional patient date of birth on staff-recorded eye tests (walk-in / family / primary).
*/
PRINT N'--- 97_eye_tests_patient_dob.sql ---';

IF COL_LENGTH('dbo.eye_tests', 'patient_dob') IS NULL
BEGIN
  ALTER TABLE dbo.eye_tests ADD patient_dob DATE NULL;
  PRINT N'Added eye_tests.patient_dob';
END
ELSE
  PRINT N'eye_tests.patient_dob already exists — skipped.';

PRINT N'--- 97_eye_tests_patient_dob.sql complete ---';
