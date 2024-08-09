start-anvil:
	anvil --block-time 2

deploy-contracts:
	cd contracts && make deploy-all

start-app:
	cd app && npm i && npm start
