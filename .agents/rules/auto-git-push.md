# Auto Git Push Rule

Whenever any code changes, bug fixes, or new features are implemented in this repository:
1. Verify the changes compile and pass relevant tests.
2. Automatically stage (`git add`), commit with a descriptive conventional commit message (`git commit -m "..."`), and push to GitHub (`git push origin master`).
3. Inform the user with the commit hash and summary of changes.
