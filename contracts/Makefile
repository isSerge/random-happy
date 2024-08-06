-include .env

deploy-drand:
	forge script script/DeployDrandOracle.s.sol --rpc-url $(RPC_URL) --broadcast --private-key $(PRIVATE_KEY)

deploy-sequencer:
	forge script script/DeploySequencerRandomOracle.s.sol --rpc-url $(RPC_URL) --broadcast --private-key $(PRIVATE_KEY)

deploy-all: 
	forge script script/DeployRandomnessOracle.s.sol --rpc-url $(RPC_URL) --broadcast --private-key $(PRIVATE_KEY)
