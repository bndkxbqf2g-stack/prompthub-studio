// Generated from knowledge/prompt-library.json by scripts/sync-prompt-library.mjs.
export default {
  "schema_version": 1,
  "curated_at": "2026-11-15",
  "entries": [
    {
      "id": "openai-codex-prompting-guide",
      "title": "Codex Prompting Guide",
      "source_url": "https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide",
      "publisher": "OpenAI",
      "author": "Noah MacCallum; Brian Fioca",
      "source_type": "official technical guide",
      "source_version": "published 2026-02-25",
      "retrieved_at": "2026-11-15",
      "license_status": "Copyrighted; no explicit reuse license identified. Metadata and original paraphrase only.",
      "categories": [
        "codex",
        "prompt-design",
        "workflow"
      ],
      "tags": [
        "scope",
        "project-context",
        "verification",
        "tool-use"
      ],
      "summary": "Shape coding-agent instructions around repository context, bounded scope, tool behavior, and verifiable outcomes. Adapt a known harness deliberately instead of copying a prompt as a complete solution.",
      "interview_hints": [
        "scope",
        "acceptance",
        "context"
      ],
      "risk_notes": [
        "Guide targets API-based Codex use; it does not establish a free API entitlement."
      ],
      "quality_estimate": {
        "relevance": 5,
        "clarity": 5,
        "safety": 4,
        "feasibility": 4,
        "testability": 4,
        "source_quality": 5,
        "method": "editorial rubric; not an empirical result"
      },
      "verified_outcomes": [],
      "checked_at": "2026-11-15",
      "review_after": "2027-02-15",
      "version": 1
    },
    {
      "id": "openai-scoped-agent-instructions",
      "title": "Rethinking skills and prompts for GPT-6 Astra",
      "source_url": "https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra",
      "publisher": "OpenAI",
      "author": "Eric Provencher",
      "source_type": "official engineering blog",
      "source_version": "published 2026-09-11",
      "retrieved_at": "2026-11-15",
      "license_status": "Copyrighted; no explicit reuse license identified. Metadata and original paraphrase only.",
      "categories": [
        "prompt-design",
        "agent-strategy",
        "context-efficiency"
      ],
      "tags": [
        "concise-instructions",
        "scoped-context",
        "avoid-duplication"
      ],
      "summary": "Keep durable agent instructions specific to safe workflows and avoid accumulating broad, repeated guidance. Reassess instruction value when model capability changes.",
      "interview_hints": [
        "scope",
        "avoid-repeated-questions"
      ],
      "risk_notes": [
        "Do not remove user-protected rules based on model-specific advice."
      ],
      "quality_estimate": {
        "relevance": 5,
        "clarity": 4,
        "safety": 4,
        "feasibility": 5,
        "testability": 3,
        "source_quality": 5,
        "method": "editorial rubric; not an empirical result"
      },
      "verified_outcomes": [],
      "checked_at": "2026-11-15",
      "review_after": "2027-02-15",
      "version": 1
    },
    {
      "id": "openai-iterating-development-workflows",
      "title": "Iterating Development Workflows with Codex",
      "source_url": "https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex",
      "publisher": "OpenAI",
      "author": "Tony Alaniz",
      "source_type": "official workflow recipe",
      "source_version": "published 2026-08-03",
      "retrieved_at": "2026-11-15",
      "license_status": "Copyrighted; no explicit reuse license identified. Metadata and original paraphrase only.",
      "categories": [
        "codex",
        "development-workflow",
        "testing",
        "approval"
      ],
      "tags": [
        "phase-gates",
        "acceptance-criteria",
        "context-reuse",
        "human-review"
      ],
      "summary": "Split larger work into phases with explicit scope, acceptance evidence, review boundaries, and retained context. Treat repository conventions as project-specific and do not invent a roadmap from absent evidence.",
      "interview_hints": [
        "scope",
        "acceptance",
        "risk",
        "approval"
      ],
      "risk_notes": [
        "The recipe is an example workflow, not a universal required file layout."
      ],
      "quality_estimate": {
        "relevance": 5,
        "clarity": 4,
        "safety": 5,
        "feasibility": 4,
        "testability": 5,
        "source_quality": 5,
        "method": "editorial rubric; not an empirical result"
      },
      "verified_outcomes": [],
      "checked_at": "2026-11-15",
      "review_after": "2027-02-15",
      "version": 1
    },
    {
      "id": "openai-codex-platform-separation",
      "title": "Codex as a platform: build on the open agent harness",
      "source_url": "https://developers.openai.com/blog/codex-as-a-platform",
      "publisher": "OpenAI",
      "author": "Nicolas Bonamy; Derrick Choi",
      "source_type": "official architecture article",
      "source_version": "published 2026-08-19",
      "retrieved_at": "2026-11-15",
      "license_status": "Copyrighted; no explicit reuse license identified. Metadata and original paraphrase only.",
      "categories": [
        "agent-architecture",
        "approval",
        "context"
      ],
      "tags": [
        "agent-loop",
        "application-control",
        "human-consent",
        "state"
      ],
      "summary": "Keep product records, authorization, approval, and business state in the application; let the agent harness manage execution, context, and tool flow behind those controls.",
      "interview_hints": [
        "context",
        "approval",
        "system-boundaries"
      ],
      "risk_notes": [
        "The article describes an open harness and does not imply free hosted model or sandbox usage."
      ],
      "quality_estimate": {
        "relevance": 5,
        "clarity": 4,
        "safety": 5,
        "feasibility": 4,
        "testability": 4,
        "source_quality": 5,
        "method": "editorial rubric; not an empirical result"
      },
      "verified_outcomes": [],
      "checked_at": "2026-11-15",
      "review_after": "2027-02-15",
      "version": 1
    },
    {
      "id": "github-actions-secure-use",
      "title": "GitHub Actions secure use reference",
      "source_url": "https://docs.github.com/en/actions/reference/security/secure-use",
      "publisher": "GitHub Docs",
      "author": "GitHub",
      "source_type": "official platform documentation",
      "source_version": "rolling documentation; review date recorded",
      "retrieved_at": "2026-11-15",
      "license_status": "GitHub documentation copyright/terms apply; store metadata and paraphrase only.",
      "categories": [
        "security",
        "ci",
        "secrets",
        "permissions"
      ],
      "tags": [
        "least-privilege",
        "secret-redaction",
        "workflow-security"
      ],
      "summary": "Grant workflow tokens the minimum permissions needed and treat secret redaction as fallible. Avoid exposing credentials through workflow output or untrusted actions.",
      "interview_hints": [
        "security",
        "approval",
        "ci"
      ],
      "risk_notes": [
        "Re-check current GitHub guidance and account permissions before workflow activation."
      ],
      "quality_estimate": {
        "relevance": 5,
        "clarity": 4,
        "safety": 5,
        "feasibility": 4,
        "testability": 4,
        "source_quality": 5,
        "method": "editorial rubric; not an empirical result"
      },
      "verified_outcomes": [],
      "checked_at": "2026-11-15",
      "review_after": "2027-02-15",
      "version": 1
    },
    {
      "id": "github-plan-usage-limits",
      "title": "GitHub product usage included with each plan",
      "source_url": "https://docs.github.com/en/billing/reference/product-usage-included",
      "publisher": "GitHub Docs",
      "author": "GitHub",
      "source_type": "official billing documentation",
      "source_version": "rolling documentation; review date recorded",
      "retrieved_at": "2026-11-15",
      "license_status": "GitHub documentation copyright/terms apply; store metadata and paraphrase only.",
      "categories": [
        "cost-control",
        "ci",
        "operations"
      ],
      "tags": [
        "quotas",
        "budget-stop",
        "monitoring"
      ],
      "summary": "Included usage varies by plan and overages may be charged unless an effective stop-usage budget is configured. Verify actual account settings and remaining shared quota before enabling jobs.",
      "interview_hints": [
        "cost",
        "availability"
      ],
      "risk_notes": [
        "This source changes over time; do not treat the cached allowance as a live account balance."
      ],
      "quality_estimate": {
        "relevance": 5,
        "clarity": 4,
        "safety": 5,
        "feasibility": 4,
        "testability": 4,
        "source_quality": 5,
        "method": "editorial rubric; not an empirical result"
      },
      "verified_outcomes": [],
      "checked_at": "2026-11-15",
      "review_after": "2026-12-15",
      "version": 1
    }
  ]
};
