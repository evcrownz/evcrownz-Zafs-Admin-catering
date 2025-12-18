// Debug script - Run this to check what's wrong
// Usage: node debug.js

const http = require('http');
const fs = require('fs');
require('dotenv').config();

console.log('🔍 DEBUGGING ZAFSKITCHEN SERVER\n');
console.log('━'.repeat(50));

// 1. Check .env file
console.log('\n1️⃣ Checking .env file...');
if (fs.existsSync('.env')) {
    console.log('   ✅ .env file exists');
    
    // Check required variables
    const required = ['DB_HOST', 'DB_PORT', 'SMTP_EMAIL', 'SMTP_PASSWORD', 'PORT'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.log('   ⚠️  Missing variables:', missing.join(', '));
    } else {
        console.log('   ✅ All required variables present');
    }
    
    console.log('   📧 Admin Email:', process.env.SMTP_EMAIL);
    console.log('   🔌 Port:', process.env.PORT || 3000);
} else {
    console.log('   ❌ .env file NOT FOUND!');
}

// 2. Check node_modules
console.log('\n2️⃣ Checking dependencies...');
const deps = ['express', 'nodemailer', 'cors', 'dotenv'];
deps.forEach(dep => {
    try {
        require.resolve(dep);
        console.log(`   ✅ ${dep} installed`);
    } catch (e) {
        console.log(`   ❌ ${dep} NOT installed`);
    }
});

// 3. Check if port 3000 is available
console.log('\n3️⃣ Checking if port 3000 is available...');
const testServer = http.createServer();
testServer.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log('   ❌ Port 3000 is ALREADY IN USE!');
        console.log('   💡 Solution: Kill the process or use different port');
    } else {
        console.log('   ❌ Error:', err.message);
    }
    testConnection();
});

testServer.once('listening', () => {
    console.log('   ✅ Port 3000 is available');
    testServer.close();
    testConnection();
});

testServer.listen(3000);

// 4. Test server connection
function testConnection() {
    console.log('\n4️⃣ Testing server connection...');
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/health',
        method: 'GET',
        timeout: 3000
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (res.statusCode === 200) {
                console.log('   ✅ Server is RUNNING and RESPONDING!');
                console.log('   📊 Response:', JSON.parse(data));
                printSummary(true);
            } else {
                console.log('   ⚠️  Server responded with status:', res.statusCode);
                printSummary(false);
            }
        });
    });

    req.on('error', (error) => {
        console.log('   ❌ Server is NOT RUNNING!');
        console.log('   📝 Error:', error.message);
        printSummary(false);
    });

    req.on('timeout', () => {
        console.log('   ❌ Connection TIMEOUT!');
        req.destroy();
        printSummary(false);
    });

    req.end();
}

function printSummary(serverRunning) {
    console.log('\n' + '━'.repeat(50));
    console.log('📋 SUMMARY\n');
    
    if (serverRunning) {
        console.log('✅ Everything is working!');
        console.log('\n🎯 Next steps:');
        console.log('   1. Open index.html in your browser');
        console.log('   2. Login with: zafskitchen95@gmail.com');
    } else {
        console.log('❌ Server is not running!\n');
        console.log('🔧 SOLUTIONS:');
        console.log('   1. Make sure you ran: npm install');
        console.log('   2. Start server: node server.js');
        console.log('   3. Check if port 3000 is free');
        console.log('   4. Check .env file has correct values');
        console.log('\n💡 Common fix:');
        console.log('   taskkill /F /IM node.exe  (Windows)');
        console.log('   pkill node                (Mac/Linux)');
        console.log('   then run: node server.js');
    }
    
    console.log('\n' + '━'.repeat(50));
}