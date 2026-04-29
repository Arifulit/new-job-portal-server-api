# Career Resources Public API

This API endpoint provides public access to career resources for frontend display.

## Endpoint

```
GET /api/v1/career-resources
```

### Response Example
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "category": "Career Tips",
      "title": "How To Build A Winning CV In 2026",
      "description": "Format, keywords, and real recruiter tips that increase shortlist rate.",
      "link": "/career-resources/cv-guide-2026",
      "buttonText": "Read Article"
    },
    {
      "id": 2,
      "category": "Interview",
      "title": "Interview Questions For Freshers",
      "description": "Prepare with practical technical and HR questions by industry.",
      "link": "/career-resources/interview-questions-freshers",
      "buttonText": "Read Article"
    },
    {
      "id": 3,
      "category": "Growth",
      "title": "Salary Negotiation In Bangladesh",
      "description": "A simple framework to negotiate confidently and professionally.",
      "link": "/career-resources/salary-negotiation-bd",
      "buttonText": "Read Article"
    }
  ]
}
```

## Usage
- No authentication required.
- Use this endpoint to display career resources on the frontend (e.g., homepage, dashboard, or a dedicated resources page).
