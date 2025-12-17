// ==========================================
// CONFIGURATION (WAJIB DIISI)
// ==========================================
const ADDR_ERC20 = "0xB58B693512CdAFcB3A782b77bB673AE84b273D5b"; // Contract Token
const ADDR_ERC721 = "0xA7E16370Bc15730ad2bf634C080AA9bfdB9B679D"; // Contract NFT
const ADDR_MANAGER = "0xb516eb6d560dCf2D4ab8ef89925F9bD999Dc565F"; // Contract Manager

// ABI
const ABI_ERC20 = ["function balanceOf(address) view returns (uint256)"];
const ABI_ERC721 = [
  "function ownerOf(uint256) view returns (address)",
  "function tokenURI(uint256) view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];
const ABI_MANAGER = [
  "function createActivity(string, uint256)",
  "function rewardStudent(uint256, address)",
  "function mintCertificate(uint256, address, string)",
  "function setActivityActive(uint256, bool)",
  "function owner() view returns (address)",
  "function nextActivityId() view returns (uint256)",
  "function getActivity(uint256) view returns (uint256, string, uint256, bool)",
];

let provider, signer, contractERC20, contractERC721, contractManager;

// Event Listener
if (window.ethereum) window.ethereum.on("accountsChanged", connectWallet);

// ==========================================
// CORE FUNCTIONS
// ==========================================
async function connectWallet() {
  if (!window.ethereum) return alert("MetaMask not found!");

  // Reset UI
  document.getElementById("adminView").classList.add("hidden");
  document.getElementById("studentView").classList.add("hidden");

  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    const address = await signer.getAddress();
    const net = await provider.getNetwork();

    // Setup Contracts
    contractERC20 = new ethers.Contract(ADDR_ERC20, ABI_ERC20, provider);
    contractERC721 = new ethers.Contract(ADDR_ERC721, ABI_ERC721, provider);
    contractManager = new ethers.Contract(ADDR_MANAGER, ABI_MANAGER, signer);

    // Cek Role
    const owner = await contractManager.owner();
    const isAdmin = address.toLowerCase() === owner.toLowerCase();

    if (isAdmin) {
      setupAdminUI(address, net.chainId);
    } else {
      setupStudentUI(address);
    }
  } catch (err) {
    console.error(err);
    alert("Gagal koneksi: " + err.message);
  }
}

// Setup Tampilan Admin
function setupAdminUI(address, chainId) {
  document.getElementById("adminView").classList.remove("hidden");
  document.getElementById("admAddress").innerText = address;
  document.getElementById("admNetwork").innerText = "Chain ID: " + chainId;
  loadActivityList(); // Load list admin
}

// Setup Tampilan Mahasiswa
async function setupStudentUI(address) {
  document.getElementById("studentView").classList.remove("hidden");

  // Update Navbar Info
  document.getElementById("stdAddress").innerText =
    address.substring(0, 6) + "..." + address.substring(38);
  document.getElementById("stdWalletBadge").classList.remove("hidden");
  document.getElementById("btnConnectStd").classList.add("hidden");

  // Load Saldo
  try {
    const bal = await contractERC20.balanceOf(address);
    document.getElementById("stdBalance").innerText = bal + " CPNT";
    document.getElementById("statPoints").innerText = bal;
  } catch (e) {}

  // Load Data
  loadMyNFTs(address);
}

// ==========================================
// MAHASISWA LOGIC
// ==========================================
function showStudentTab(id) {
  document.getElementById("viewMyCerts").classList.add("hidden");
  document.getElementById("viewActivities").classList.add("hidden");
  document.getElementById(id).classList.remove("hidden");

  // Highlight Tab Button
  const btns = document.querySelectorAll(".pill-btn");
  btns.forEach((b) => b.classList.remove("active"));
  event.target.classList.add("active");

  if (id === "viewActivities") loadAllActivitiesStudent();
}

async function loadMyNFTs(userAddress) {
  const grid = document.getElementById("certGrid");
  if (!userAddress && signer) userAddress = await signer.getAddress();
  grid.innerHTML = "<p>Scanning Blockchain...</p>";

  try {
    const filter = contractERC721.filters.Transfer(null, userAddress);
    const events = await contractERC721.queryFilter(filter);
    let count = 0;

    grid.innerHTML = "";

    for (let event of events) {
      const tokenId = event.args[2];
      const currentOwner = await contractERC721.ownerOf(tokenId);

      if (currentOwner.toLowerCase() === userAddress.toLowerCase()) {
        count++;
        const uri = await contractERC721.tokenURI(tokenId);

        // Card HTML
        grid.innerHTML += `
                <div class="cert-card">
                    <div class="cert-img-placeholder">📜</div>
                    <div class="cert-body">
                        <div class="cert-title">Sertifikat #${tokenId}</div>
                        <div class="cert-meta">Kepemilikan Valid • On-Chain</div>
                        <button class="btn-block" onclick="openCertModal('${uri}', '${tokenId}')">Lihat Detail</button>
                    </div>
                </div>`;
      }
    }
    document.getElementById("statCertCount").innerText = count;
    if (count === 0)
      grid.innerHTML =
        "<p style='grid-column:1/-1; text-align:center'>Belum ada sertifikat.</p>";
  } catch (err) {
    console.error(err);
  }
}

async function loadAllActivitiesStudent() {
  const list = document.getElementById("studentActivityList");
  list.innerHTML = "<p>Loading...</p>";

  try {
    const nextId = await contractManager.nextActivityId();
    let html = "";

    // Loop Reverse
    for (let i = Number(nextId) - 1; i >= 1; i--) {
      const act = await contractManager.getActivity(i);
      // act[3] adalah isActive. Jika false (mati), JANGAN tampilkan di mahasiswa.
      if (!act[3]) continue;

      html += `
            <div class="activity-row">
                <div class="act-info">
                    <h4>${act[1]}</h4>
                    <p>Reward: ${act[2]} CPNT • ID #${act[0]}</p>
                </div>
                <div class="tag-active">SEDANG BERLANGSUNG</div>
            </div>`;
    }

    if (html === "")
      html =
        "<p style='text-align:center; padding:20px'>Tidak ada kegiatan aktif saat ini.</p>";
    list.innerHTML = html;
  } catch (err) {
    console.error(err);
  }
}

// ==========================================
// MODAL & JSON VIEWER (FITUR BARU)
// ==========================================
async function openCertModal(uri, tokenId) {
  const modal = document.getElementById("detailModal");
  modal.classList.remove("hidden");

  // Reset View
  switchModalView("preview");
  document.getElementById("modalContentPreview").innerHTML =
    "Loading Metadata...";
  document.getElementById("modalJsonCode").innerText = "Fetching...";

  try {
    const fetchUrl = uri.replace("ipfs://", "https://ipfs.io/ipfs/");
    const res = await fetch(fetchUrl);
    const json = await res.json();

    // 1. Tampilan Visual
    const imgUrl = json.image
      ? json.image.replace("ipfs://", "https://ipfs.io/ipfs/")
      : "";
    document.getElementById("modalContentPreview").innerHTML = `
            ${imgUrl ? `<img src="${imgUrl}" class="modal-img">` : ""}
            <h2 style="margin-bottom:10px">${json.name}</h2>
            <p style="color:#94a3b8; line-height:1.6">${json.description}</p>
            <div style="margin-top:20px; font-size:12px; color:#6366f1">Token ID: #${tokenId}</div>
        `;

    // 2. Tampilan JSON (Pretty Print)
    document.getElementById("modalJsonCode").innerText = JSON.stringify(
      json,
      null,
      2
    );
  } catch (err) {
    document.getElementById("modalContentPreview").innerHTML =
      "Gagal memuat metadata. <br> <a href='" +
      uri +
      "' target='_blank'>Buka Link Asli</a>";
    document.getElementById("modalJsonCode").innerText = "Error fetching JSON.";
  }
}

function switchModalView(view) {
  const tabs = document.querySelectorAll(".modal-tab");
  tabs.forEach((t) => t.classList.remove("active"));
  event.target.classList.add("active"); // Highlight clicked tab (akan error jika dipanggil via code tanpa event, tapi aman disini)

  if (view === "preview") {
    document.getElementById("modalViewPreview").classList.remove("hidden");
    document.getElementById("modalViewJson").classList.add("hidden");
  } else {
    document.getElementById("modalViewPreview").classList.add("hidden");
    document.getElementById("modalViewJson").classList.remove("hidden");
  }
}
function closeModal() {
  document.getElementById("detailModal").classList.add("hidden");
}

// ==========================================
// ADMIN LOGIC
// ==========================================
function showAdminTab(id) {
  document
    .querySelectorAll(".admin-pane")
    .forEach((e) => e.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  document
    .querySelectorAll(".menu-item")
    .forEach((e) => e.classList.remove("active"));
  event.target.classList.add("active");
}

async function createActivity() {
  handleTx(
    contractManager.createActivity(
      document.getElementById("actName").value,
      document.getElementById("actReward").value
    )
  );
}
async function rewardStudent() {
  handleTx(
    contractManager.rewardStudent(
      document.getElementById("rewardActId").value,
      document.getElementById("rewardStudentAddr").value
    )
  );
}
async function mintCertificate() {
  handleTx(
    contractManager.mintCertificate(
      document.getElementById("mintActId").value,
      document.getElementById("mintStudentAddr").value,
      document.getElementById("mintUri").value
    )
  );
}

async function loadActivityList() {
  const box = document.getElementById("adminActivityList");
  box.innerHTML = "Loading...";
  try {
    const nextId = await contractManager.nextActivityId();
    let html = "";
    for (let i = Number(nextId) - 1; i >= 1; i--) {
      const act = await contractManager.getActivity(i);
      const isActive = act[3];

      // Tombol Toggle
      const btn = isActive
        ? `<button onclick="toggleActivity(${act[0]}, false)" style="color:#ef4444; border:1px solid #ef4444; background:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Stop</button>`
        : `<button onclick="toggleActivity(${act[0]}, true)" style="color:#10b981; border:1px solid #10b981; background:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Start</button>`;

      html += `
            <div class="adm-item">
                <div>
                    <strong>${act[1]}</strong>
                    <div style="font-size:11px; color:#9ca3af">ID: ${
                      act[0]
                    } • Reward: ${act[2]}</div>
                </div>
                <div style="display:flex; align-items:center; gap:10px">
                    <div class="status-dot ${
                      isActive ? "dot-green" : "dot-red"
                    }"></div>
                    ${btn}
                </div>
            </div>`;
    }
    box.innerHTML = html;
  } catch (e) {
    console.error(e);
  }
}

async function toggleActivity(id, status) {
  if (!confirm("Ubah status?")) return;
  handleTx(contractManager.setActivityActive(id, status));
}

async function handleTx(promise) {
  try {
    const tx = await promise;
    await tx.wait();
    alert("Berhasil!");
    loadActivityList();
  } catch (e) {
    alert("Gagal: " + (e.reason || e.message));
  }
}
