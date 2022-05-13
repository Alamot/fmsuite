# Start 10 workers for thumbnailing
for i in {1..10}; do 
  ./worker.py &
done
# Trap to kill all the child processes (i.e. the workers) when the script terminates.
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT
# Start our web app
FLASK_APP=fmsuite FLASK_ENV=development flask run
