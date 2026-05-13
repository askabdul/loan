#!/bin/bash
mkdir -p /tmp/empty_dir

echo "Cleaning backend old node_modules..."
rsync -a --delete /tmp/empty_dir/ /Users/salamaziz/Documents/workspace/loanApp/apps/backend/node_modules.old.23332/
rmdir /Users/salamaziz/Documents/workspace/loanApp/apps/backend/node_modules.old.23332
echo "backend done"

echo "Cleaning admin old node_modules..."
rsync -a --delete /tmp/empty_dir/ /Users/salamaziz/Documents/workspace/loanApp/apps/admin/node_modules.old.17687/
rmdir /Users/salamaziz/Documents/workspace/loanApp/apps/admin/node_modules.old.17687
echo "admin done"

echo "Cleaning cedLoan old node_modules..."
rsync -a --delete /tmp/empty_dir/ /Users/salamaziz/Documents/workspace/loanApp/apps/cedLoan/node_modules.old.8291/
rmdir /Users/salamaziz/Documents/workspace/loanApp/apps/cedLoan/node_modules.old.8291
echo "cedLoan done"

echo "All old node_modules cleaned up!"
