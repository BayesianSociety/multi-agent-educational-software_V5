#!/usr/bin/env python3
"""Deterministic multi-step Codex orchestrator.

Implements the stable engine contract against PROJECT_BRIEF.md.
"""

from __future__ import annotations

import argparse
import dataclasses
import fnmatch
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple


# -----------------------------
# Error codes (deterministic)
# -----------------------------
ERR_NOT_GIT_REPO = "NOT_GIT_REPO"
ERR_GIT_STAGED_NOT_EMPTY = "GIT_STAGED_NOT_EMPTY"
ERR_BRIEF_MISSING = "BRIEF_MISSING"
ERR_BRIEF_YAML_INVALID = "BRIEF_YAML_INVALID"
ERR_BRIEF_LAYER_MISSING = "BRIEF_LAYER_MISSING"
ERR_CODEX_NOT_FOUND = "CODEX_NOT_FOUND"
ERR_ALLOWLIST_VIOLATION = "ALLOWLIST_VIOLATION"
ERR_FORBIDDEN_PATH = "FORBIDDEN_PATH"
ERR_PATH_TRAVERSAL = "PATH_TRAVERSAL"
ERR_SYMLINK_VIOLATION = "SYMLINK_VIOLATION"
ERR_CHANGE_CAP_FILES = "CHANGE_CAP_FILES"
ERR_CHANGE_CAP_BYTES = "CHANGE_CAP_BYTES"
ERR_CHANGE_CAP_DELETES = "CHANGE_CAP_DELETES"
ERR_STEP_EXIT_NONZERO = "STEP_EXIT_NONZERO"
ERR_TRANSIENT_RETRY_EXHAUSTED = "TRANSIENT_RETRY_EXHAUSTED"
ERR_PROMPT_TOO_SHORT = "PROMPT_TOO_SHORT"
ERR_PROMPT_MISSING_LAYER0 = "PROMPT_MISSING_LAYER0"
ERR_PROMPT_ROLE_COVERAGE_GAP = "PROMPT_ROLE_COVERAGE_GAP"
ERR_PROMPT_MISSING_ACCEPTANCE = "PROMPT_MISSING_ACCEPTANCE"
ERR_PROMPT_GENERIC_EXCERPT = "PROMPT_GENERIC_EXCERPT"
ERR_TEST_CMD_MISSING = "TEST_CMD_MISSING"
ERR_TEST_CMD_FAILED = "TEST_CMD_FAILED"
ERR_BACKEND_UNUSED = "BACKEND_UNUSED"
ERR_PROJECT_BRIEF_LOCK_VIOLATION = "PROJECT_BRIEF_LOCK_VIOLATION"
ERR_VALIDATOR_FAILED = "VALIDATOR_FAILED"

TRANSIENT_PATTERNS = (
    "transport",
    "connection reset",
    "econnreset",
    "timed out",
    "timeout",
    "broken pipe",
    "temporarily unavailable",
)

CHANGE_CAPS = {
    "max_changed_files": 60,
    "max_total_bytes_changed": 500000,
    "max_deleted_files": 0,
}

MANDATORY_STEPS = [
    "release_engineer",
    "planner",
    "requirements",
    "designer",
    "frontend",
    "backend",
    "qa",
    "docs",
    "product_acceptance_gate",
]

ROLE_LAYER_MAP = {
    "release_engineer": ["Layer 0", "Required Outputs", "Product Acceptance Gate", "Role Targets"],
    "planner": ["Layer 0", "Layer 1", "Layer 2", "Layer 3", "Required Outputs", "Product Acceptance Gate", "Role Targets"],
    "requirements": ["Layer 0", "Layer 1", "Layer 2", "Layer 3", "Product Acceptance Gate"],
    "designer": ["Layer 0", "Layer 1", "Layer 3", "Product Acceptance Gate"],
    "frontend": ["Layer 0", "Layer 1", "Layer 2", "Layer 3", "Product Acceptance Gate"],
    "backend": ["Layer 0", "Layer 1", "Layer 2", "Product Acceptance Gate"],
    "qa": ["Layer 0", "Layer 1", "Layer 2", "Layer 3", "Product Acceptance Gate", "Required Outputs"],
    "docs": ["Layer 0", "Layer 1", "Layer 2", "Layer 3", "Required Outputs", "Product Acceptance Gate"],
    "product_acceptance_gate": ["Layer 0", "Layer 1", "Layer 2", "Layer 3", "Required Outputs", "Product Acceptance Gate", "Role Targets"],
}

STEP_ALLOWLISTS = {
    "release_engineer": [
        "REQUIREMENTS.md",
        "TEST.md",
        "AGENT_TASKS.md",
        "README.md",
        "RUNBOOK.md",
        "design/**",
        "frontend/**",
        "backend/**",
        "tests/**",
        ".env.example",
        ".gitignore",
        "prompts/**",
        ".codex/skills/**",
    ],
    "planner": ["AGENT_TASKS.md", "prompts/planner/**", ".codex/skills/planner/**"],
    "requirements": ["REQUIREMENTS.md", "prompts/requirements/**", ".codex/skills/requirements/**"],
    "designer": ["design/**", "prompts/designer/**", ".codex/skills/designer/**"],
    "frontend": ["frontend/**", "prompts/frontend/**", ".codex/skills/frontend/**", "tests/**"],
    "backend": ["backend/**", "prompts/backend/**", ".codex/skills/backend/**", "tests/**", ".env.example", ".gitignore"],
    "qa": ["tests/**", "TEST.md", "prompts/qa/**", ".codex/skills/qa/**"],
    "docs": ["README.md", "RUNBOOK.md", "REQUIREMENTS.md", "AGENT_TASKS.md", "prompts/docs/**", ".codex/skills/docs/**"],
    "product_acceptance_gate": ["**"],
}


@dataclasses.dataclass
class FileState:
    rel_path: str
    is_file: bool
    is_symlink: bool
    digest: Optional[str]
    size: int
    data: Optional[bytes]


@dataclasses.dataclass
class Snapshot:
    files: Dict[str, FileState]
    untracked: List[str]
    head: str


@dataclasses.dataclass
class RunAttemptResult:
    exit_code: int
    stdout: str
    stderr: str
    retries_used: int
    transport_retry_exhausted: bool


class DeterministicOrchestrator:
    def __init__(self, repo_root: Path, visibility: str = "quiet", strategy: Optional[str] = None) -> None:
        self.repo_root = repo_root
        self.visibility = visibility
        self.orch_dir = self.repo_root / ".orchestrator"
        self.runs_dir = self.orch_dir / "runs"
        self.evals_dir = self.orch_dir / "evals"
        self.policy_path = self.orch_dir / "policy.json"
        self.run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        self.run_dir = self.runs_dir / self.run_id
        self.prompt_map_path = self.run_dir / "prompt_map.json"
        self.project_brief_path = self.repo_root / "PROJECT_BRIEF.md"
        self.project_brief_locked_hash: Optional[str] = None
        self.codex_flags = {
            "experimental_json": False,
            "output_schema": False,
            "ask_for_approval": False,
            "config": False,
        }
        self.policy = self._load_policy()
        if strategy:
            self.policy["selection_strategy"] = strategy

    # ---------- core utilities ----------
    def log(self, msg: str) -> None:
        if self.visibility == "verbose":
            print(msg)

    def shell(self, args: Sequence[str], input_text: Optional[str] = None, check: bool = False) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            list(args),
            input=input_text,
            text=True,
            capture_output=True,
            cwd=str(self.repo_root),
            check=check,
        )

    def utc_now(self) -> str:
        return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    def sha256_bytes(self, data: bytes) -> str:
        h = hashlib.sha256()
        h.update(data)
        return h.hexdigest()

    def sha256_text(self, text: str) -> str:
        return self.sha256_bytes(text.encode("utf-8", errors="ignore"))

    def _load_policy(self) -> Dict[str, Any]:
        if self.policy_path.exists():
            try:
                return json.loads(self.policy_path.read_text(encoding="utf-8"))
            except Exception:
                pass
        return {
            "version": 1,
            "selection_strategy": "ucb1",
            "roles": {},
            "unsupported_flags": {},
        }

    def _save_policy(self) -> None:
        self.orch_dir.mkdir(parents=True, exist_ok=True)
        self.policy_path.write_text(json.dumps(self.policy, indent=2, sort_keys=True), encoding="utf-8")

    def ensure_git_repo(self) -> None:
        cp = self.shell(["git", "rev-parse", "--is-inside-work-tree"])
        if cp.returncode != 0 or cp.stdout.strip() != "true":
            self.fail(ERR_NOT_GIT_REPO)
        self.ensure_git_integrity()

    def ensure_git_integrity(self) -> None:
        staged = self.shell(["git", "diff", "--cached", "--name-only"])
        if staged.returncode != 0:
            self.fail(ERR_NOT_GIT_REPO)
        if staged.stdout.strip():
            self.fail(ERR_GIT_STAGED_NOT_EMPTY)

    def fail(self, code: str, details: Optional[str] = None) -> None:
        payload = {"error": code}
        if details:
            payload["details"] = details
        print(json.dumps(payload, indent=2))
        sys.exit(1)

    def detect_codex_flags(self) -> None:
        try:
            cp = self.shell(["codex", "exec", "--help"])
        except FileNotFoundError:
            self.fail(ERR_CODEX_NOT_FOUND)
            return
        if cp.returncode != 0:
            self.fail(ERR_CODEX_NOT_FOUND)

        help_text = (cp.stdout or "") + "\n" + (cp.stderr or "")
        flag_map = {
            "experimental_json": "--experimental-json",
            "output_schema": "--output-schema",
            "ask_for_approval": "--ask-for-approval",
            "config": "--config",
        }
        unsupported = []
        for k, flag in flag_map.items():
            supported = flag in help_text
            self.codex_flags[k] = supported
            if not supported:
                unsupported.append(flag)
        self.policy.setdefault("unsupported_flags", {})
        self.policy["unsupported_flags"][self.run_id] = unsupported

    def get_head(self) -> str:
        cp = self.shell(["git", "rev-parse", "HEAD"])
        if cp.returncode != 0:
            self.fail(ERR_NOT_GIT_REPO)
        return cp.stdout.strip()

    def get_untracked(self) -> List[str]:
        cp = self.shell(["git", "ls-files", "--others", "--exclude-standard", "-z"])
        if cp.returncode != 0:
            return []
        raw = cp.stdout
        return sorted([p for p in raw.split("\x00") if p])

    def is_volatile_runtime_artifact(self, rel: str) -> bool:
        if "/__pycache__/" in rel or rel.startswith("__pycache__/"):
            return True
        if rel.endswith(".pyc") or rel.endswith(".pyo"):
            return True
        if "/node_modules/" in rel or rel.startswith("node_modules/"):
            return True
        if rel.startswith(".pytest_cache/") or rel.startswith(".mypy_cache/") or rel.startswith(".ruff_cache/"):
            return True
        if rel == ".coverage" or rel.startswith("coverage/") or "/coverage/" in rel:
            return True
        if rel.endswith(".tsbuildinfo") or rel.endswith(".log"):
            return True
        return False

    def capture_snapshot(self) -> Snapshot:
        files: Dict[str, FileState] = {}
        for path in sorted(self.repo_root.rglob("*")):
            if not path.exists():
                continue
            rel = path.relative_to(self.repo_root).as_posix()
            if rel.startswith(".git/"):
                continue
            if self.is_volatile_runtime_artifact(rel):
                continue
            if path.is_dir():
                continue
            is_symlink = path.is_symlink()
            if is_symlink:
                target = os.readlink(path)
                data = target.encode("utf-8", errors="ignore")
                digest = self.sha256_bytes(data)
                size = len(data)
                files[rel] = FileState(rel, True, True, digest, size, data)
                continue
            try:
                data = path.read_bytes()
            except Exception:
                continue
            files[rel] = FileState(rel, True, False, self.sha256_bytes(data), len(data), data)
        return Snapshot(files=files, untracked=self.get_untracked(), head=self.get_head())

    def compute_diff(self, pre: Snapshot, post: Snapshot) -> Dict[str, Any]:
        pre_paths = set(pre.files.keys())
        post_paths = set(post.files.keys())
        added = sorted(post_paths - pre_paths)
        deleted = sorted(pre_paths - post_paths)
        common = sorted(pre_paths & post_paths)
        modified = []
        bytes_changed = 0
        for p in common:
            if pre.files[p].digest != post.files[p].digest or pre.files[p].is_symlink != post.files[p].is_symlink:
                modified.append(p)
                bytes_changed += abs(post.files[p].size - pre.files[p].size) + max(pre.files[p].size, post.files[p].size)
        for p in added:
            bytes_changed += post.files[p].size
        for p in deleted:
            bytes_changed += pre.files[p].size
        changed_paths = sorted(set(added + deleted + modified))
        return {
            "added": added,
            "deleted": deleted,
            "modified": modified,
            "changed_paths": changed_paths,
            "bytes_changed": bytes_changed,
        }

    def rollback_to_snapshot(self, pre: Snapshot, post: Snapshot) -> None:
        pre_paths = set(pre.files.keys())
        post_paths = set(post.files.keys())

        # Restore files that existed before
        for rel in sorted(pre_paths):
            src = pre.files[rel]
            full = self.repo_root / rel
            full.parent.mkdir(parents=True, exist_ok=True)
            if src.is_symlink:
                if full.exists() or full.is_symlink():
                    full.unlink()
                os.symlink(src.data.decode("utf-8", errors="ignore"), full)
            else:
                full.write_bytes(src.data or b"")

        # Remove files created during run window
        for rel in sorted(post_paths - pre_paths):
            full = self.repo_root / rel
            if full.exists() or full.is_symlink():
                full.unlink()

        # Cleanup empty dirs for unauthorized untracked tree changes
        for rel in sorted(post_paths - pre_paths, reverse=True):
            parent = (self.repo_root / rel).parent
            while parent != self.repo_root and parent.exists():
                try:
                    parent.rmdir()
                except OSError:
                    break
                parent = parent.parent

    def match_allowlist(self, rel_path: str, allowlist: Sequence[str]) -> bool:
        if not allowlist:
            return False
        for pat in allowlist:
            if fnmatch.fnmatch(rel_path, pat):
                return True
            if pat.endswith("/**"):
                base = pat[:-3]
                if rel_path == base or rel_path.startswith(base + "/"):
                    return True
        return False

    def enforce_diff_invariants(self, step: str, diff: Dict[str, Any], post: Snapshot) -> List[str]:
        codes: List[str] = []
        allowlist = STEP_ALLOWLISTS.get(step, [])

        for rel in diff["changed_paths"]:
            if rel.startswith(".git/") or rel == ".git":
                codes.append(ERR_FORBIDDEN_PATH)
            if rel.startswith(".orchestrator/") or rel == ".orchestrator":
                codes.append(ERR_FORBIDDEN_PATH)
            if ".." in Path(rel).parts:
                codes.append(ERR_PATH_TRAVERSAL)
            if rel in post.files and post.files[rel].is_symlink:
                codes.append(ERR_SYMLINK_VIOLATION)
            if not self.match_allowlist(rel, allowlist):
                codes.append(ERR_ALLOWLIST_VIOLATION)

        if len(diff["changed_paths"]) > CHANGE_CAPS["max_changed_files"]:
            codes.append(ERR_CHANGE_CAP_FILES)
        if diff["bytes_changed"] > CHANGE_CAPS["max_total_bytes_changed"]:
            codes.append(ERR_CHANGE_CAP_BYTES)
        if len(diff["deleted"]) > CHANGE_CAPS["max_deleted_files"]:
            codes.append(ERR_CHANGE_CAP_DELETES)

        if self.project_brief_locked_hash is not None:
            current_hash = self.sha256_bytes(self.project_brief_path.read_bytes())
            if current_hash != self.project_brief_locked_hash:
                codes.append(ERR_PROJECT_BRIEF_LOCK_VIOLATION)

        return sorted(set(codes))

    # ---------- brief extraction ----------
    def read_brief(self) -> str:
        if not self.project_brief_path.exists():
            self.fail(ERR_BRIEF_MISSING)
        return self.project_brief_path.read_text(encoding="utf-8")

    def validate_brief_structure(self, text: str) -> List[str]:
        codes = []
        for layer in ["# Layer 0", "# Layer 1", "# Layer 2", "# Layer 3"]:
            if layer not in text:
                codes.append(ERR_BRIEF_LAYER_MISSING)
        return codes

    def split_top_sections(self, text: str) -> Dict[str, str]:
        matches = list(re.finditer(r"^#\s+(.+?)\s*$", text, flags=re.M))
        sections: Dict[str, str] = {}
        if not matches:
            return sections
        for i, m in enumerate(matches):
            start = m.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            name = m.group(1).strip()
            sections[name] = text[start:end].strip() + "\n"
        return sections

    def extract_role_excerpt(self, step: str, brief_text: str) -> Tuple[str, List[str], List[str], int, int, float]:
        sections = self.split_top_sections(brief_text)
        role_sections = ROLE_LAYER_MAP.get(step, ["Layer 0", "Layer 1", "Layer 2", "Layer 3"])

        included_names: List[str] = []
        included_blocks: List[str] = []
        for name in role_sections:
            if name in sections:
                included_names.append(name)
                included_blocks.append(sections[name])

        excerpt = "\n\n".join(included_blocks).strip() + "\n"

        all_requirements = self.extract_requirement_ids("\n\n".join(included_blocks))
        included_requirements = list(all_requirements)
        required_count = len(all_requirements)
        included_count = len(included_requirements)
        coverage = 1.0 if required_count == 0 else included_count / required_count
        return excerpt, included_names, included_requirements, required_count, included_count, coverage

    def extract_requirement_ids(self, text: str) -> List[str]:
        reqs = []
        idx = 1
        for line in text.splitlines():
            if re.match(r"^\s*[-*]\s+", line) or re.match(r"^\s*\d+\.\s+", line):
                reqs.append(f"REQ-{idx:04d}")
                idx += 1
        return reqs

    def build_manifest_excerpt(self, snapshot: Snapshot, limit: int = 60) -> str:
        lines = []
        for rel in sorted(snapshot.files.keys())[:limit]:
            digest = snapshot.files[rel].digest or ""
            lines.append(f"- {rel} :: {digest[:16]}")
        return "\n".join(lines)

    # ---------- prompt variant selection ----------
    def load_skill(self, step: str) -> Tuple[Optional[Path], str, str]:
        skill_path = self.repo_root / ".codex" / "skills" / step / "SKILL.md"
        if not skill_path.exists():
            return None, "", "NO_SKILL"
        body = skill_path.read_text(encoding="utf-8")
        return skill_path, body, self.sha256_text(body)

    def load_variants(self, step: str) -> List[Tuple[str, str]]:
        variants: List[Tuple[str, str]] = []
        sources = [
            self.repo_root / "prompts" / step,
            self.repo_root / ".orchestrator" / "prompt_templates" / step,
        ]
        for src in sources:
            if src.exists():
                for p in sorted(src.rglob("*.txt")):
                    rel = p.relative_to(self.repo_root).as_posix()
                    variants.append((rel, p.read_text(encoding="utf-8")))
        if not variants:
            embedded = self.embedded_template(step)
            variants.append((f"embedded/{step}/default", embedded))
        return variants

    def embedded_template(self, step: str) -> str:
        return (
            f"You are acting as {step}.\n"
            "Implement only the required edits for your role.\n"
            "Follow PROJECT_BRIEF.md exactly.\n"
            "Do not modify .orchestrator/** or .git/**.\n"
            "Return completed file edits in repository only.\n"
        )

    def _role_policy_bucket(self, role: str, epoch: str) -> Dict[str, Any]:
        roles = self.policy.setdefault("roles", {})
        role_node = roles.setdefault(role, {"epochs": {}})
        epoch_node = role_node["epochs"].setdefault(epoch, {"variants": {}})
        return epoch_node

    def choose_variant(self, step: str, variants: List[Tuple[str, str]], prompt_epoch_id: str) -> str:
        strategy = self.policy.get("selection_strategy", "ucb1")
        epoch_node = self._role_policy_bucket(step, prompt_epoch_id)
        for variant_id, _ in variants:
            epoch_node["variants"].setdefault(
                variant_id,
                {"attempts": 0, "passes": 0, "clean_passes": 0, "failures": {}},
            )

        ordered_ids = sorted([v[0] for v in variants])

        if strategy == "explore_then_commit":
            for vid in ordered_ids:
                if epoch_node["variants"][vid]["attempts"] == 0:
                    return vid
            best = sorted(
                ordered_ids,
                key=lambda x: (
                    -(epoch_node["variants"][x]["passes"] / max(1, epoch_node["variants"][x]["attempts"])),
                    x,
                ),
            )[0]
            return best

        if strategy == "rr_elimination":
            # Deterministic round robin while pass-rate >= 0.2, else eliminate.
            alive = [
                vid
                for vid in ordered_ids
                if epoch_node["variants"][vid]["attempts"] == 0
                or (epoch_node["variants"][vid]["passes"] / max(1, epoch_node["variants"][vid]["attempts"])) >= 0.2
            ]
            if not alive:
                alive = ordered_ids
            total_attempts = sum(epoch_node["variants"][v]["attempts"] for v in alive)
            return alive[total_attempts % len(alive)]

        # default ucb1
        total_attempts = sum(epoch_node["variants"][v]["attempts"] for v in ordered_ids)
        for vid in ordered_ids:
            if epoch_node["variants"][vid]["attempts"] == 0:
                return vid
        best_vid = None
        best_score = None
        for vid in ordered_ids:
            stats = epoch_node["variants"][vid]
            a = stats["attempts"]
            p = stats["passes"]
            mean = p / max(1, a)
            bonus = (2.0 * (max(1, total_attempts)).bit_length() / a) ** 0.5
            score = mean + bonus
            if best_score is None or score > best_score or (score == best_score and vid < (best_vid or "~")):
                best_score = score
                best_vid = vid
        return best_vid or ordered_ids[0]

    def update_policy_stats(
        self,
        step: str,
        prompt_epoch_id: str,
        variant_id: str,
        pass_ok: bool,
        clean_pass: bool,
        validation_codes: List[str],
    ) -> None:
        epoch_node = self._role_policy_bucket(step, prompt_epoch_id)
        stats = epoch_node["variants"][variant_id]
        stats["attempts"] += 1
        if pass_ok:
            stats["passes"] += 1
        if clean_pass:
            stats["clean_passes"] += 1
        for c in validation_codes:
            stats["failures"][c] = stats["failures"].get(c, 0) + 1

    # ---------- validators ----------
    def validate_prompt_quality(
        self,
        step: str,
        prompt: str,
        excerpt: str,
        coverage_ratio: float,
    ) -> List[str]:
        codes = []
        prompt_word_count = len(re.findall(r"\S+", prompt))
        excerpt_word_count = len(re.findall(r"\S+", excerpt))
        bullet_count = len([l for l in excerpt.splitlines() if re.match(r"^\s*[-*]\s+", l)])
        acceptance_bullets = [l for l in excerpt.splitlines() if "acceptance" in l.lower()]

        if prompt_word_count < 220:
            codes.append(ERR_PROMPT_TOO_SHORT)
        if "Layer 0" not in prompt:
            codes.append(ERR_PROMPT_MISSING_LAYER0)
        if coverage_ratio < 1.0:
            codes.append(ERR_PROMPT_ROLE_COVERAGE_GAP)
        if not acceptance_bullets and "Product Acceptance Gate" not in excerpt:
            codes.append(ERR_PROMPT_MISSING_ACCEPTANCE)

        # Strength gate: conservative deterministic interpretation.
        if excerpt_word_count < 1200 and bullet_count < 8:
            codes.append(ERR_PROMPT_GENERIC_EXCERPT)

        return sorted(set(codes))

    def validate_required_files(self) -> List[str]:
        required = ["REQUIREMENTS.md", "TEST.md", "AGENT_TASKS.md", "README.md", "RUNBOOK.md"]
        missing = [p for p in required if not (self.repo_root / p).exists()]
        return [ERR_VALIDATOR_FAILED] if missing else []

    def validate_required_dirs(self) -> List[str]:
        required = ["design", "frontend", "backend", "tests", "prompts", ".codex/skills"]
        missing = [p for p in required if not (self.repo_root / p).exists()]
        return [ERR_VALIDATOR_FAILED] if missing else []

    def validate_backend_contract(self) -> List[str]:
        codes: List[str] = []
        backend_dir = self.repo_root / "backend"
        if not backend_dir.exists():
            codes.append(ERR_BACKEND_UNUSED)
            return codes

        texts = []
        for p in sorted(backend_dir.rglob("*")):
            if p.is_file() and p.suffix.lower() in {".py", ".ts", ".js", ".json", ".sql", ".md"}:
                try:
                    texts.append(p.read_text(encoding="utf-8", errors="ignore"))
                except Exception:
                    pass
        corpus = "\n".join(texts)

        required_endpoint_groups = [
            ["/health"],
            ["/api/levels"],
            ["/api/levels/:id", "/api/levels/"],
            ["/api/session/start"],
            ["/api/session/end"],
            ["/api/events/batch"],
            ["/api/analytics/dashboard"],
            ["/api/analytics/puzzle/:id", "/api/analytics/puzzle/"],
            ["/api/analytics/events"],
        ]
        for alternatives in required_endpoint_groups:
            if not any(endpoint_path in corpus for endpoint_path in alternatives):
                codes.append(ERR_BACKEND_UNUSED)
                break
        return sorted(set(codes))

    def extract_test_commands(self) -> Tuple[List[str], List[str]]:
        path = self.repo_root / "TEST.md"
        if not path.exists():
            return [], [ERR_TEST_CMD_MISSING]
        text = path.read_text(encoding="utf-8", errors="ignore")
        m = re.search(r"^##\s+How to run tests\s*$", text, flags=re.M | re.I)
        if not m:
            m = re.search(r"^##\s+Deterministic QA Command\s*$", text, flags=re.M | re.I)
        if m:
            tail = text[m.end() :]
        else:
            tail = text
        code_m = re.search(r"```[a-zA-Z0-9_-]*\n(.*?)\n```", tail, flags=re.S)
        if not code_m:
            return [], [ERR_TEST_CMD_MISSING]
        lines = []
        for line in code_m.group(1).splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith("#"):
                continue
            lines.append(stripped)
        if not lines:
            return [], [ERR_TEST_CMD_MISSING]
        return lines, []

    def run_test_commands(self) -> List[str]:
        lines, codes = self.extract_test_commands()
        if codes:
            return codes
        for cmd in lines:
            cp = subprocess.run(
                ["bash", "-lc", cmd],
                cwd=str(self.repo_root),
                capture_output=True,
                text=True,
                env={
                    **os.environ,
                    "PYTHONDONTWRITEBYTECODE": "1",
                },
            )
            if cp.returncode != 0:
                return [ERR_TEST_CMD_FAILED]
        return []

    def step_validators(self, step: str) -> List[str]:
        codes: List[str] = []

        if step == "release_engineer":
            brief = self.read_brief()
            codes.extend(self.validate_brief_structure(brief))
            codes.extend(self.validate_required_files())

        if step in {"frontend", "backend", "qa", "docs", "product_acceptance_gate"}:
            # Infra expectations if backend required.
            if self.backend_required():
                for f in [".gitignore", ".env.example"]:
                    if not (self.repo_root / f).exists():
                        codes.append(ERR_VALIDATOR_FAILED)

        # Backend evidence checks after frontend/backend opportunity.
        if step in {"qa", "docs", "product_acceptance_gate"} and self.backend_required():
            codes.extend(self.validate_backend_contract())

        if step == "product_acceptance_gate":
            codes.extend(self.validate_required_dirs())
            codes.extend(self.run_test_commands())

        return sorted(set(codes))

    # ---------- hooks interfaces ----------
    def prompt_library_bootstrap(self) -> Dict[str, Any]:
        """Hook A interface: prompts/** and .codex/skills/** writes only."""
        return {
            "name": "prompt_library_bootstrap",
            "allowed_write_scope": ["prompts/**", ".codex/skills/**"],
            "status": "interface_only",
        }

    def prompt_tuner(self) -> Dict[str, Any]:
        """Hook B interface: prompts/** and .codex/skills/** writes only with deterministic gate."""
        return {
            "name": "prompt_tuner",
            "allowed_write_scope": ["prompts/**", ".codex/skills/**"],
            "status": "interface_only",
            "guardrail_validators": [
                "file_size_caps",
                "required_skill_front_matter_keys",
                "forbidden_unsafe_substrings",
                "non_empty_actionable_skill_body",
            ],
        }

    def validate_tuner_guardrails(self, path: Path, text: str) -> List[str]:
        codes = []
        if len(text.encode("utf-8")) > 128000:
            codes.append("GUARDRAIL_FILE_TOO_LARGE")
        if path.name == "SKILL.md":
            if "---" not in text:
                codes.append("GUARDRAIL_SKILL_FRONTMATTER_MISSING")
            for key in ["name", "description"]:
                if re.search(rf"^\s*{re.escape(key)}\s*:", text, flags=re.M) is None:
                    codes.append("GUARDRAIL_SKILL_KEY_MISSING")
        forbidden = ["rm -rf /", "curl | sh", "Invoke-Expression"]
        lowered = text.lower()
        if any(s.lower() in lowered for s in forbidden):
            codes.append("GUARDRAIL_UNSAFE_SUBSTRING")
        body = re.sub(r"^---.*?---\s*", "", text, flags=re.S)
        if len(body.strip()) < 20:
            codes.append("GUARDRAIL_SKILL_EMPTY_BODY")
        return sorted(set(codes))

    # ---------- codex run ----------
    def build_codex_cmd(self) -> List[str]:
        cmd = ["codex", "exec", "--sandbox", "workspace-write", "-"]
        return cmd

    def run_codex_prompt(self, prompt: str) -> RunAttemptResult:
        cmd = self.build_codex_cmd()
        retries_used = 0
        last_cp: Optional[subprocess.CompletedProcess[str]] = None
        for i in range(3):
            cp = subprocess.run(
                cmd,
                cwd=str(self.repo_root),
                input=prompt,
                text=True,
                capture_output=True,
            )
            last_cp = cp
            output_blob = (cp.stdout or "") + "\n" + (cp.stderr or "")
            is_transient = cp.returncode != 0 and any(p in output_blob.lower() for p in TRANSIENT_PATTERNS)
            if not is_transient:
                return RunAttemptResult(cp.returncode, cp.stdout, cp.stderr, retries_used, False)
            if i < 2:
                retries_used += 1
                time.sleep(i + 1)
                continue
            return RunAttemptResult(cp.returncode, cp.stdout, cp.stderr, retries_used, True)
        assert last_cp is not None
        return RunAttemptResult(last_cp.returncode, last_cp.stdout, last_cp.stderr, retries_used, False)

    # ---------- workflow ----------
    def backend_required(self) -> bool:
        brief = self.read_brief().lower()
        return "frontend and backend are both required" in brief or "backend are both required" in brief

    def make_step_prompt(
        self,
        step: str,
        variant_text: str,
        skill_text: str,
        excerpt: str,
        manifest_excerpt: str,
    ) -> str:
        return (
            f"# Role\n{step}\n\n"
            "# Deterministic Constraints\n"
            "- Follow Layer 0 constraints from PROJECT_BRIEF.md exactly.\n"
            "- Use only role-owned edits for this step.\n"
            "- Do not modify .orchestrator/** or .git/**.\n"
            "- Deterministic output only; avoid narrative claims.\n\n"
            "# Role Variant\n"
            f"{variant_text.strip()}\n\n"
            "# Skill Body\n"
            f"{skill_text.strip() if skill_text else 'NO_SKILL'}\n\n"
            "# Project Brief Excerpt\n"
            f"{excerpt.strip()}\n\n"
            "# Read-only Hashed Manifest Excerpt\n"
            f"{manifest_excerpt}\n\n"
            "# Required Instruction\n"
            "Follow PROJECT_BRIEF.md as authoritative and implement role-relevant requirements and acceptance criteria.\n"
        )

    def ensure_artifact_dirs(self) -> None:
        self.orch_dir.mkdir(parents=True, exist_ok=True)
        self.runs_dir.mkdir(parents=True, exist_ok=True)
        self.evals_dir.mkdir(parents=True, exist_ok=True)
        self.run_dir.mkdir(parents=True, exist_ok=True)
        (self.run_dir / "steps").mkdir(parents=True, exist_ok=True)

    def write_json(self, path: Path, obj: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(obj, indent=2, sort_keys=True), encoding="utf-8")

    def run(self) -> int:
        self.ensure_git_repo()
        brief_text = self.read_brief()
        codes = self.validate_brief_structure(brief_text)
        if codes:
            self.fail(codes[0], details=",".join(codes))

        self.detect_codex_flags()
        self.ensure_artifact_dirs()

        steps = list(MANDATORY_STEPS)
        if not self.backend_required() and "backend" in steps:
            steps.remove("backend")

        prompt_map: Dict[str, Any] = {"run_id": self.run_id, "steps": {}, "flags": self.codex_flags}
        eval_summary: Dict[str, Any] = {
            "run_id": self.run_id,
            "started_at": self.utc_now(),
            "steps": [],
            "status": "in_progress",
        }

        for step in steps:
            self.log(f"[step] {step}")
            step_dir = self.run_dir / "steps" / step
            step_dir.mkdir(parents=True, exist_ok=True)

            variants = self.load_variants(step)
            skill_path, skill_text, skill_hash = self.load_skill(step)
            selected_variant_id, selected_variant_text = variants[0]
            prompt_epoch_id = self.sha256_text(selected_variant_text + "\n" + (skill_text or "NO_SKILL"))
            selected_variant_id = self.choose_variant(step, variants, prompt_epoch_id)
            selected_variant_text = dict(variants)[selected_variant_id]

            excerpt, brief_sections, req_ids, role_req_count, role_included_count, coverage_ratio = self.extract_role_excerpt(step, brief_text)

            pre_manifest = self.capture_snapshot()
            manifest_excerpt = self.build_manifest_excerpt(pre_manifest)
            prompt = self.make_step_prompt(step, selected_variant_text, skill_text, excerpt, manifest_excerpt)

            prompt_codes = self.validate_prompt_quality(step, prompt, excerpt, coverage_ratio)
            if prompt_codes:
                attempt_record = {
                    "step_name": step,
                    "attempt": 1,
                    "variant_id": selected_variant_id,
                    "prompt_epoch_id": prompt_epoch_id,
                    "exit_code": 1,
                    "changed_paths": [],
                    "validation_codes": prompt_codes,
                    "rollback_applied": False,
                    "retries_used": 0,
                    "skill_path": skill_path.relative_to(self.repo_root).as_posix() if skill_path else None,
                    "skill_hash": skill_hash,
                    "skill_used": bool(skill_text),
                    "prompt_word_count": len(re.findall(r"\S+", prompt)),
                    "brief_sections_included": brief_sections,
                    "requirement_ids_included": req_ids,
                    "role_required_requirement_count": role_req_count,
                    "role_included_requirement_count": role_included_count,
                    "coverage_ratio": coverage_ratio,
                    "timestamp_utc": self.utc_now(),
                }
                self.write_json(step_dir / "attempt_1.json", attempt_record)
                self.update_policy_stats(step, prompt_epoch_id, selected_variant_id, False, False, prompt_codes)
                eval_summary["steps"].append({"step": step, "status": "failed", "codes": prompt_codes})
                eval_summary["status"] = "failed"
                eval_summary["ended_at"] = self.utc_now()
                self.write_json(self.evals_dir / f"{self.run_id}.json", eval_summary)
                self._save_policy()
                self.write_json(self.prompt_map_path, prompt_map)
                print(json.dumps({"run_id": self.run_id, "status": "failed", "step": step, "codes": prompt_codes}, indent=2))
                return 1

            prompt_map["steps"][step] = {
                "variant_id": selected_variant_id,
                "prompt_epoch_id": prompt_epoch_id,
                "skill_path": skill_path.relative_to(self.repo_root).as_posix() if skill_path else None,
                "skill_hash": skill_hash,
                "brief_sections_included": brief_sections,
            }

            step_passed = False
            last_codes: List[str] = []
            for attempt in range(1, 4):
                self.ensure_git_integrity()
                pre = self.capture_snapshot()
                run_result = self.run_codex_prompt(prompt)
                post = self.capture_snapshot()
                diff = self.compute_diff(pre, post)

                validation_codes = []
                if run_result.exit_code != 0:
                    validation_codes.append(ERR_STEP_EXIT_NONZERO)
                if run_result.transport_retry_exhausted:
                    validation_codes.append(ERR_TRANSIENT_RETRY_EXHAUSTED)
                validation_codes.extend(self.enforce_diff_invariants(step, diff, post))
                validation_codes.extend(self.step_validators(step))
                validation_codes = sorted(set(validation_codes))

                rollback_applied = False
                if validation_codes:
                    self.rollback_to_snapshot(pre, post)
                    rollback_applied = True

                attempt_record = {
                    "step_name": step,
                    "attempt": attempt,
                    "variant_id": selected_variant_id,
                    "prompt_epoch_id": prompt_epoch_id,
                    "exit_code": run_result.exit_code,
                    "changed_paths": diff["changed_paths"],
                    "validation_codes": validation_codes,
                    "rollback_applied": rollback_applied,
                    "retries_used": run_result.retries_used,
                    "skill_path": skill_path.relative_to(self.repo_root).as_posix() if skill_path else None,
                    "skill_hash": skill_hash,
                    "skill_used": bool(skill_text),
                    "prompt_word_count": len(re.findall(r"\S+", prompt)),
                    "brief_sections_included": brief_sections,
                    "requirement_ids_included": req_ids,
                    "role_required_requirement_count": role_req_count,
                    "role_included_requirement_count": role_included_count,
                    "coverage_ratio": coverage_ratio,
                    "timestamp_utc": self.utc_now(),
                }
                self.write_json(step_dir / f"attempt_{attempt}.json", attempt_record)

                pass_ok = not validation_codes
                clean_pass = pass_ok and not diff["deleted"]
                self.update_policy_stats(step, prompt_epoch_id, selected_variant_id, pass_ok, clean_pass, validation_codes)

                if pass_ok:
                    step_passed = True
                    last_codes = []
                    if step == "release_engineer":
                        self.project_brief_locked_hash = self.sha256_bytes(self.project_brief_path.read_bytes())
                    break

                last_codes = validation_codes

            if not step_passed:
                eval_summary["steps"].append({"step": step, "status": "failed", "codes": last_codes})
                eval_summary["status"] = "failed"
                eval_summary["ended_at"] = self.utc_now()
                self.write_json(self.evals_dir / f"{self.run_id}.json", eval_summary)
                self.write_json(self.prompt_map_path, prompt_map)
                self._save_policy()
                print(json.dumps({"run_id": self.run_id, "status": "failed", "step": step, "codes": last_codes}, indent=2))
                return 1

            eval_summary["steps"].append({"step": step, "status": "passed", "codes": []})

        eval_summary["status"] = "passed"
        eval_summary["ended_at"] = self.utc_now()
        self.write_json(self.prompt_map_path, prompt_map)
        self.write_json(self.evals_dir / f"{self.run_id}.json", eval_summary)
        self._save_policy()

        print(json.dumps({"run_id": self.run_id, "status": "passed"}, indent=2))
        return 0


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Deterministic Codex orchestrator")
    p.add_argument("--visibility", choices=["quiet", "verbose"], default="quiet")
    p.add_argument("--strategy", choices=["ucb1", "explore_then_commit", "rr_elimination"], default=None)
    return p.parse_args(argv)


def main(argv: Sequence[str]) -> int:
    args = parse_args(argv)
    orch = DeterministicOrchestrator(repo_root=Path.cwd(), visibility=args.visibility, strategy=args.strategy)
    return orch.run()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
