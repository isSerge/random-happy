-include .env

# Path to store the deployed addresses
DEPLOYED_ADDRESSES_FILE=../app/src/deployed_addresses.json
RUN_LATEST_FILE=./broadcast/DeployRandomnessOracle.s.sol/31337/run-latest.json

extract-addresses:
	@jq '{ DRAND_ORACLE_ADDRESS: (.transactions[] | select(.contractName == "DrandOracle").contractAddress), \
	SEQUENCER_ORACLE_ADDRESS: (.transactions[] | select(.contractName == "SequencerRandomOracle").contractAddress), \
	RANDOMNESS_ORACLE_ADDRESS: (.transactions[] | select(.contractName == "RandomnessOracle").contractAddress) }' \
	$(RUN_LATEST_FILE) > $(DEPLOYED_ADDRESSES_FILE) && \
	echo "Addresses saved to $(DEPLOYED_ADDRESSES_FILE)"

deploy-drand:
	forge script script/DeployDrandOracle.s.sol --rpc-url $(RPC_URL) --broadcast --private-key $(PRIVATE_KEY)

deploy-sequencer:
	forge script script/DeploySequencerRandomOracle.s.sol --rpc-url $(RPC_URL) --broadcast --private-key $(PRIVATE_KEY)

deploy-all:
	forge script script/DeployRandomnessOracle.s.sol --rpc-url $(RPC_URL) --broadcast --private-key $(PRIVATE_KEY) && \
	make extract-addresses
