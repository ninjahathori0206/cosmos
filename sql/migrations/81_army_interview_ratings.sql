/*
  Migration 81 — Army HR interview rubric ratings

  Deploy: npm run migrate:81-army-interview-ratings
*/
USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT N'Migration 81: Army HR interview ratings';
GO

IF OBJECT_ID(N'dbo.army_application_interview_ratings', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.army_application_interview_ratings (
    interview_rating_id      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    application_interview_id INT              NOT NULL,
    scores_json              NVARCHAR(MAX)    NOT NULL,
    aggregate_score          DECIMAL(4,1)       NOT NULL,
    notes                    NVARCHAR(2000)   NOT NULL,
    recommendation_key       NVARCHAR(20)     NOT NULL,
    rated_by                 INT              NULL,
    created_at               DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_at               DATETIME2(0)     NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_army_int_rating_interview FOREIGN KEY (application_interview_id)
      REFERENCES dbo.army_application_interviews(application_interview_id) ON DELETE CASCADE,
    CONSTRAINT UQ_army_int_rating_interview UNIQUE (application_interview_id),
    CONSTRAINT CK_army_int_rating_recommendation CHECK (recommendation_key IN (
      N'PROCEED', N'HOLD', N'REJECT'
    ))
  );
  CREATE INDEX IX_army_int_ratings_interview ON dbo.army_application_interview_ratings(application_interview_id);
  PRINT N'Migration 81: created army_application_interview_ratings';
END
ELSE
  PRINT N'Migration 81: army_application_interview_ratings already exists — skipped';
GO

PRINT N'Migration 81: complete';
GO
