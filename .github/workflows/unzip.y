name: unzip
on:
  push:
    paths: ['renderizer.zip']
permissions:
  contents: write
jobs:
  unzip:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Ekstrak
        run: |
          unzip -o renderizer.zip
          cp -r renderizer/. .
          rm -rf renderizer renderizer.zip
      - name: Commit
        run: |
          git config user.name "unzip-bot"
          git config user.email "bot@users.noreply.github.com"
          git add -A
          git commit -m "Extract renderizer"
          git push
