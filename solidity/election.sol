import "../lib/system.sol";

@program_id("TAs8imC3KXDBRqb4V997dV31bfL8sbjRPwWGYQEggEW")
contract election {
    struct Runner {
        string name;
        uint64 vote;
    }

    address owner;
    address debit;

    mapping(address => uint64) voters;
    Runner[] runners;

    @payer(payer)
    @space(1088 + 1024)
    constructor(address _owner, address _debit) {
        // set contract owner
        owner = _owner;
        // ser contract debit account, customly the data account
        debit = _debit;
    }

    @signer(owner)
    function setOwner(address _owner) external {
        assert(tx.accounts.owner.key == owner && tx.accounts.owner.is_signer);
        owner = _owner;
    }

    @signer(owner)
    function addRunner(string name) external {
        assert(tx.accounts.owner.key == owner && tx.accounts.owner.is_signer);
        runners.push(Runner(name, 0));
    }

    @mutableAccount(from)
    @mutableSigner(owner)
    function withdraw(uint64 lamports) external {
        assert(tx.accounts.owner.key == owner && tx.accounts.owner.is_signer);

        AccountInfo from = tx.accounts.from;
        AccountInfo to = tx.accounts.owner;
        assert(lamports <= from.lamports);

        from.lamports -= lamports;
        to.lamports += lamports;
    }

    // Transfer SOL from one account to another using CPI (Cross Program Invocation) to the System program
    @mutableSigner(sender)
    function vote(uint64 id, uint64 lamports) external {
        assert(id >= 0 && id < runners.length);
        address sender = tx.accounts.sender.key;
        // trasnfer to data account
        SystemInstruction.transfer(sender, debit, lamports);
        // add votes to runner
        runners[id].vote += lamports;
        // add votes record for the sender
        voters[sender] += lamports;
    }

    // get runner info
    function getRunner(uint64 id) public view returns (Runner) {
        return runners[id];
    }

    // get vote amount by address
    function getVoteAmount(address addr) public view returns (uint64) {
        return voters[addr];
    }
}
