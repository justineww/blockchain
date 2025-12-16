let provider;
let signer;

const ERC20_ADDRESS = "ISI_ALAMAT_ERC20";
const ERC721_ADDRESS = "ISI_ALAMAT_ERC721";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)"
];

const ERC721_ABI = [
  "function ownerOf(uint256) view returns (address)",
  "function tokenURI(uint256) view returns (string)"
];

document.getElementById("connectBtn").onclick = async () => {
  if (!window.ethereum) {
    alert("MetaMask tidak terdeteksi");
    return;
  }

  provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();

  const address = await signer.getAddress();
  const network = await provider.getNetwork();

  document.getElementById("address").innerText = address;
  document.getElementById("network").innerText = network.name;

  loadBalance(address);
};

async function loadBalance(userAddress) {
  const token = new ethers.Contract(ERC20_ADDRESS, ERC20_ABI, provider);
  const balance = await token.balanceOf(userAddress);

  document.getElementById("balance").innerText =
    ethers.utils.formatUnits(balance, 18);
}

document.getElementById("checkNFT").onclick = async () => {
  const tokenId = document.getElementById("tokenIdInput").value;

  if (!tokenId) {
    alert("Masukkan token ID");
    return;
  }

  const nft = new ethers.Contract(ERC721_ADDRESS, ERC721_ABI, provider);

  try {
    const owner = await nft.ownerOf(tokenId);
    const uri = await nft.tokenURI(tokenId);

    document.getElementById("nftOwner").innerText = owner;
    document.getElementById("nftURI").innerText = uri;
  } catch (err) {
    alert("Token ID tidak ditemukan");
  }
};

.web3 {
  color: #4f46e5;   /* biru-ungu Web3 vibe */
  font-weight: bold;
}
