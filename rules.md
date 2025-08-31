# Git Repository Guidelines

These guidelines ensure a clean workflow, reduce merge conflicts, and keep the repository history organized.

---

## 1. Branching Strategy

- Always create a new branch for your work.
- The branch name should clearly reflect the nature of the work.
  - Example:
    - For frontend user payment logic → `user_payment_frontend` or `userPaymentFrontend`.

### Command to create and switch to a new branch

```bash
git checkout -b branch_name

```

## 2. Avoid Direct Commits to main

- Never commit or merge code directly into the main branch.

- Always merge changes only after review, and ensure no conflicts exist.

- Keep main stable and production-ready at all times.

- If there is conflit in code disscuss with team then raise new **PR** (Pull Request) .

## 3. Pull Requests (PRs)

- raise a Pull Request (PR) for merging code.

- PRs must include a clear and concise description of:

  - The purpose of the changes.

  - The functionality implemented or issues fixed.

## 4. Commit Messages

- Write meaningful, concise commit messages describing the change.

- Examples:

  ```bash
  feat(auth): add login validation

  fix(cart): resolve duplicate product issue

  docs: update README with setup instructions
  ```

## 5. Sync Regularly with Remote

```bash
  git pull origin main
 or
  git pull origin branchName

```

## 6. Check Status Before Committing

Always verify your changes before committing:

```bash
    git status
    git diff


```

## 7. The env.sample file contains all the required key–value pairs used in the code
