const CONTRACT_ADDRESS = "0x4ea609060bcdc64b27f6e4654b84d2ca11b9f92c";
const CHAIN_ID = 93384;
const RPC_URL = "https://assam-rpc.tea.xyz";

// Gas settings yang sesuai untuk Tea Network
const GAS_SETTINGS = {
    GAS_LIMIT: '0x3D0900', // Ditingkatkan untuk mengakomodasi auto transfer
    GAS_MULTIPLIER: 1.4    // Buffer yang lebih besar
};

// Transaction polling settings
const TX_POLLING = {
    MAX_ATTEMPTS: 50,
    INTERVAL: 3000, // 3 seconds
    TIMEOUT: 180000 // 3 minutes
};

// Paste ABI lengkap disini
const CONTRACT_ABI = [
    {
        "inputs": [{"internalType":"address","name":"initialOwner","type":"address"}],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [],
        "name": "DOMAIN_EXTENSION",
        "outputs": [{"internalType":"string","name":"","type":"string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType":"string","name":"","type":"string"}],
        "name": "domainExists",
        "outputs": [{"internalType":"bool","name":"","type":"bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getBalance",
        "outputs": [{"internalType":"uint256","name":"","type":"uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "nextTokenId",
        "outputs": [{"internalType":"uint256","name":"","type":"uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"internalType":"address","name":"","type":"address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType":"string","name":"username","type":"string"}],
        "name": "registerDomain",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "registrationFee",
        "outputs": [{"internalType":"uint256","name":"","type":"uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType":"uint256","name":"","type":"uint256"}],
        "name": "tokenIdToDomain",
        "outputs": [{"internalType":"string","name":"","type":"string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "stateMutability": "payable",
        "type": "receive"
    },
    {
        "stateMutability": "payable",
        "type": "fallback"
    }
];

let web3;
let account = null;
let domainContract;
let touchStartX = 0;
let touchEndX = 0;
let currentPosition = 0;
let isTransactionPending = false;
const itemWidth = 150;
const visibleItems = 6;
let totalItems = 0;

// Initialize Web3
if (typeof window.ethereum !== 'undefined') {
    web3 = new Web3(window.ethereum);
    domainContract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
}

// DOM Elements
const connectButton = document.getElementById('connectButton');
const walletInfo = document.getElementById('walletInfo');
const domainInput = document.getElementById('domainInput');
const checkButton = document.getElementById('checkButton');
const domainStatus = document.getElementById('domainStatus');
const claimButton = document.getElementById('claimButton');
const recentDomains = document.getElementById('recentDomains');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');
const carouselViewport = document.querySelector('.carousel-viewport');

// Toast Notification Handler
const toastContainer = document.createElement('div');
toastContainer.className = 'toast-container';
document.body.appendChild(toastContainer);

function createToast(title, message, type = 'success', duration = 5000) {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    
    const loader = type === 'pending' ? '<span class="toast-loader"></span>' : '';
    const closeButton = type !== 'pending' ? '<button class="toast-close">×</button>' : '';
    
    toast.innerHTML = `
        <div class="toast-content">
            <div class="toast-title ${type}">
                ${loader}${title}
            </div>
            <div class="toast-message">${message}</div>
        </div>
        ${closeButton}
    `;

    if (type !== 'pending') {
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => removeToast(toast));
    }

    toastContainer.appendChild(toast);

    if (duration && type !== 'pending') {
        setTimeout(() => removeToast(toast), duration);
    }

    return toast;
}

function removeToast(toast) {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => {
        if (toastContainer.contains(toast)) {
            toastContainer.removeChild(toast);
        }
    }, 300);
}

function showStatus(message, type) {
    const statusEl = document.getElementById('domainStatus');
    statusEl.textContent = message;
    statusEl.className = `domain-status status-${type}`;
}

function clearStatus() {
    const statusEl = document.getElementById('domainStatus');
    statusEl.textContent = '';
    statusEl.className = 'domain-status';
}

// Connect wallet function
async function connectWallet() {
    try {
        if (typeof window.ethereum !== 'undefined') {
            const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
            const chainId = await ethereum.request({ method: 'eth_chainId' });
            
            if (parseInt(chainId, 16) !== CHAIN_ID) {
                createToast(
                    'Network Error',
                    'Please switch to Tea Network (Chain ID: 93384)',
                    'error',
                    5000
                );
                return;
            }

            account = accounts[0];
            await updateUIForConnectedWallet();
            await updateRecentDomains();
            createToast('Connected!', 'Wallet connected successfully', 'success', 5000);
        } else {
            createToast('Error!', 'Please install MetaMask', 'error', 5000);
        }
    } catch (error) {
        createToast('Error!', error.message, 'error', 5000);
    }
}

// Update UI for connected wallet
async function updateUIForConnectedWallet() {
    try {
        const balance = await web3.eth.getBalance(account);
        const teaBalance = web3.utils.fromWei(balance, 'ether');
        
        connectButton.style.display = 'none';
        walletInfo.innerHTML = `
            <span class="wallet-address">${account.slice(0,6)}...${account.slice(-4)}</span>
            <span class="wallet-balance">${parseFloat(teaBalance).toFixed(2)} $TEA</span>
            <span class="connection-status">Connected</span>
        `;
        walletInfo.classList.add('active');
    } catch (error) {
        console.error('Error updating wallet UI:', error);
    }
}

// Enhanced transaction handling
async function sendTransaction(tx) {
    try {
        // Get current gas price
        const gasPrice = await web3.eth.getGasPrice();
        
        // Estimate gas untuk transaksi ini
        const estimatedGas = await web3.eth.estimateGas({
            from: tx.from,
            to: tx.to,
            value: tx.value,
            data: tx.data
        });

        // Prepare transaction dengan gas yang sesuai
        const finalGas = Math.min(
            Math.floor(estimatedGas * GAS_SETTINGS.GAS_MULTIPLIER),
            parseInt(GAS_SETTINGS.GAS_LIMIT, 16)
        );

        tx = {
            ...tx,
            gas: web3.utils.toHex(finalGas)
        };

        // Send transaction
        const txHash = await ethereum.request({
            method: 'eth_sendTransaction',
            params: [tx]
        });

        return txHash;
    } catch (error) {
        console.error('Transaction error:', error);
        throw new Error(error.message);
    }
}

// Check domain availability
async function checkDomain() {
    const domainName = domainInput.value.trim();
    if (!domainName) {
        createToast('Error!', 'Please enter a domain name', 'error', 5000);
        return;
    }

    try {
        const exists = await domainContract.methods.domainExists(domainName + '.assam').call();
        if (exists) {
            domainStatus.textContent = `${domainName}.assam is not available`;
            claimButton.disabled = true;
        } else {
            domainStatus.textContent = `${domainName}.assam is available`;
            claimButton.disabled = false;
        }
    } catch (error) {
        createToast('Error!', 'Error checking domain: ' + error.message, 'error', 5000);
    }
}

// Register domain
async function claimDomain() {
    if (!account) {
        createToast('Error!', 'Connect wallet first', 'error', 5000);
        return;
    }

    const domainName = domainInput.value.trim();
    if (!domainName) {
        createToast('Error!', 'Enter domain name', 'error', 5000);
        return;
    }

    try {
        const registrationFee = '0x1158e460913d00000'; // 20 TEA
        const data = domainContract.methods.registerDomain(domainName).encodeABI();

        // Check balance
        const balance = await web3.eth.getBalance(account);
        if (web3.utils.toBN(balance).lt(web3.utils.toBN(registrationFee))) {
            createToast('Error!', 'Insufficient balance', 'error', 5000);
            return;
        }

        const pendingToast = createToast(
            'Processing',
            'Confirm in wallet', // Pesan lebih singkat
            'pending'
        );

        const tx = {
            from: account,
            to: CONTRACT_ADDRESS,
            value: registrationFee,
            data: data
        };

        const txHash = await sendTransaction(tx);
        domainInput.value = '';
        claimButton.disabled = true;

        checkTransactionStatus(txHash, pendingToast);
    } catch (error) {
        createToast('Error!', 'Registration failed', 'error', 5000);
        clearStatus();
    }
}

// Check transaction status
async function checkTransactionStatus(txHash, pendingToast) {
    let attempts = 0;
    const startTime = Date.now();

    const checkReceipt = async () => {
        try {
            const receipt = await web3.eth.getTransactionReceipt(txHash);
            
            if (receipt) {
                removeToast(pendingToast);
                if (receipt.status) {
                    createToast(
                        'Success!',
                        'Domain registered!', // Pesan lebih singkat
                        'success',
                        5000
                    );
                    clearStatus();
                    await updateRecentDomains();
                    await updateUIForConnectedWallet();
                } else {
                    createToast(
                        'Error!',
                        'Registration failed', // Pesan lebih singkat
                        'error',
                        5000
                    );
                    clearStatus();
                }
                return;
            }

            attempts++;
            if (attempts >= TX_POLLING.MAX_ATTEMPTS || (Date.now() - startTime) > TX_POLLING.TIMEOUT) {
                removeToast(pendingToast);
                createToast(
                    'Warning!',
                    'Transaction delayed', // Pesan lebih singkat
                    'warning',
                    5000
                );
                return;
            }

            setTimeout(checkReceipt, TX_POLLING.INTERVAL);
        } catch (error) {
            removeToast(pendingToast);
            createToast(
                'Error!',
                'Transaction failed', // Pesan lebih singkat
                'error',
                5000
            );
            clearStatus();
        }
    };

    checkReceipt();
}

// Update recent domains
async function updateRecentDomains() {
    try {
        const nextTokenId = await domainContract.methods.nextTokenId().call();
        let domains = [];
        const startIndex = Math.max(0, parseInt(nextTokenId) - 12);
        
        for (let i = parseInt(nextTokenId) - 1; i >= startIndex; i--) {
            try {
                const domain = await domainContract.methods.tokenIdToDomain(i).call();
                if (domain) {
                    domains.push(domain);
                }
            } catch (error) {
                console.warn(`Error fetching domain ${i}:`, error);
                continue;
            }
        }

        totalItems = domains.length;
        recentDomains.innerHTML = domains.map(domain => `
            <div class="domain-item">${domain}</div>
        `).join('');

        updateCarouselButtons();
    } catch (error) {
        console.error('Error updating recent domains:', error);
    }
}

// Carousel controls
function getVisibleItems() {
    const width = window.innerWidth;
    if (width > 1200) return 6;
    if (width > 992) return 5;
    if (width > 768) return 4;
    if (width > 576) return 3;
    return 2;
}

function slideCarousel(direction) {
    const visibleItems = getVisibleItems();
    const maxPosition = Math.max(0, totalItems - visibleItems);
    
    if (direction === 'next' && currentPosition < maxPosition) {
        currentPosition++;
    } else if (direction === 'prev' && currentPosition > 0) {
        currentPosition--;
    }
    
    const itemWidth = recentDomains.querySelector('.domain-item')?.offsetWidth || 150;
    const gapWidth = 15;
    const translateValue = currentPosition * -(itemWidth + gapWidth);
    recentDomains.style.transform = `translateX(${translateValue}px)`;
    
    updateCarouselButtons(maxPosition);
}

function updateCarouselButtons(maxPosition = null) {
    if (maxPosition === null) {
        const visibleItems = getVisibleItems();
        maxPosition = Math.max(0, totalItems - visibleItems);
    }
    
    prevButton.disabled = currentPosition === 0;
    nextButton.disabled = currentPosition >= maxPosition;
}

// Touch handlers
function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
}

function handleTouchMove(e) {
    touchEndX = e.touches[0].clientX;
}

function handleTouchEnd() {
    const swipeThreshold = 50;
    const swipeDistance = touchStartX - touchEndX;
    
    if (Math.abs(swipeDistance) > swipeThreshold) {
        if (swipeDistance > 0) {
            slideCarousel('next');
        } else {
            slideCarousel('prev');
        }
    }
}

// Event Listeners
connectButton.addEventListener('click', connectWallet);
checkButton.addEventListener('click', checkDomain);
claimButton.addEventListener('click', claimDomain);
prevButton.addEventListener('click', () => slideCarousel('prev'));
nextButton.addEventListener('click', () => slideCarousel('next'));

// Touch event listeners
carouselViewport.addEventListener('touchstart', handleTouchStart, {passive: true});
carouselViewport.addEventListener('touchmove', handleTouchMove, {passive: true});
carouselViewport.addEventListener('touchend', handleTouchEnd);

// Window resize handler
window.addEventListener('resize', () => {
    currentPosition = 0;
    recentDomains.style.transform = 'translateX(0)';
    updateCarouselButtons();
});

// MetaMask Events
if (window.ethereum) {
    ethereum.on('accountsChanged', function (accounts) {
        account = accounts[0] || null;
        if (account) {
            updateUIForConnectedWallet();
        } else {
            connectButton.style.display = 'block';
            walletInfo.classList.remove('active');
            walletInfo.innerHTML = '';
        }
    });

    ethereum.on('chainChanged', function (chainId) {
        window.location.reload();
    });
}

// Start polling for updates
function startPolling() {
    setInterval(async () => {
        if (account) {
            try {
                await updateRecentDomains();
                await updateUIForConnectedWallet();
            } catch (error) {
                console.error('Polling error:', error);
            }
        }
    }, 5000);
}

// Initialize on page load
window.addEventListener('load', () => {
    if (web3) {
        updateRecentDomains();
        startPolling();
    }
});