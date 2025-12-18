require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cors());

// Store OTPs temporarily
const otpStore = new Map();

// Brevo API configuration
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_FROM_EMAIL = process.env.BREVO_FROM;
const BREVO_FROM_NAME = process.env.BREVO_NAME;

// Get admin email from environment
const ADMIN_EMAIL = process.env.SMTP_EMAIL || 'zafskitchen95@gmail.com';

// 1. Send OTP Endpoint
app.post('/api/send-otp', async (req, res) => {
    const { email } = req.body;

    console.log(`📧 OTP request from: ${email}`);

    try {
        // Check if email is the authorized admin
        if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
            console.log('❌ Unauthorized email attempt');
            return res.json({ 
                success: false, 
                message: 'Unauthorized email. Only admin can access this system.' 
            });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store OTP with 5 minute expiry
        otpStore.set(email, {
            otp: otp,
            expires: Date.now() + 5 * 60 * 1000 // 5 minutes
        });

        console.log(`🔑 Generated OTP for ${email}: ${otp}`);

        // Brevo API request
        const brevoData = {
            sender: {
                name: BREVO_FROM_NAME,
                email: BREVO_FROM_EMAIL
            },
            to: [
                {
                    email: email,
                    name: 'Administrator'
                }
            ],
            subject: 'Admin Login Verification Code - Zaf\'s Kitchen',
            htmlContent: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset='UTF-8'>
                    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                    <title>Admin Verification</title>
                </head>
                <body style='font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;'>
                    <div style='max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;'>
                        <div style='text-align: center; margin-bottom: 30px;'>
                            <h1 style='color: #DC2626; margin: 0; font-size: 32px;'>Zaf's Kitchen</h1>
                            <p style='color: #666; margin: 5px 0 0 0; font-size: 14px;'>Admin Dashboard</p>
                        </div>
                        
                        <h2 style='color: #DC2626; margin-bottom: 20px; font-size: 24px;'>Admin Login Verification</h2>
                        <p style='margin-bottom: 15px;'>Hello <strong>Administrator</strong>,</p>
                        <p style='margin-bottom: 20px; line-height: 1.6;'>You have requested to access the admin dashboard. Please use the following verification code to complete your login:</p>
                        
                        <div style='background: linear-gradient(135deg, #f8f9fa, #e9ecef); padding: 30px; text-align: center; margin: 30px 0; border-radius: 12px; border-left: 5px solid #DC2626;'>
                            <p style='margin: 0 0 10px 0; font-size: 14px; color: #666;'>Your Verification Code:</p>
                            <h1 style='color: #DC2626; font-size: 42px; letter-spacing: 8px; margin: 0; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);'>${otp}</h1>
                        </div>
                        
                        <div style='background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;'>
                            <p style='margin: 0; color: #856404;'><strong>Important:</strong> This code will expire in <strong>5 minutes</strong> for security purposes.</p>
                        </div>
                        
                        <p style='margin-bottom: 20px; line-height: 1.6;'>If you didn't request this code, please ignore this email.</p>
                        
                        <div style='margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;'>
                            <p style='font-size: 12px; color: #666; text-align: center; margin: 0; line-height: 1.5;'>
                                This is an automated message from Zaf's Kitchen.<br>
                                Please do not reply to this email.<br>
                                <br>
                                © ${new Date().getFullYear()} Zaf's Kitchen. All rights reserved.
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        // Send email via Brevo API
        const response = await axios.post(
            'https://api.brevo.com/v3/smtp/email',
            brevoData,
            {
                headers: {
                    'api-key': BREVO_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.status === 201) {
            console.log(`✅ OTP email sent successfully to ${email}`);
            res.json({ 
                success: true, 
                message: 'OTP sent successfully to your email' 
            });
        } else {
            throw new Error(`Brevo API returned status: ${response.status}`);
        }

    } catch (error) {
        console.error('❌ Send OTP error:', error.response?.data || error.message);
        res.json({ 
            success: false, 
            message: 'Failed to send OTP. Please try again.' 
        });
    }
});

// 2. Verify OTP Endpoint
app.post('/api/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    console.log(`🔍 Verifying OTP for: ${email}`);

    try {
        // Check if email is authorized
        if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
            console.log('❌ Unauthorized email attempt');
            return res.json({ 
                success: false, 
                message: 'Unauthorized access' 
            });
        }

        const stored = otpStore.get(email);

        if (!stored) {
            console.log('❌ OTP not found or expired');
            return res.json({ 
                success: false, 
                message: 'OTP expired or not found. Please request a new one.' 
            });
        }

        // Check if OTP expired
        if (Date.now() > stored.expires) {
            otpStore.delete(email);
            console.log('❌ OTP expired');
            return res.json({ 
                success: false, 
                message: 'OTP has expired. Please request a new one.' 
            });
        }

        // Check if OTP matches
        if (stored.otp !== otp) {
            console.log('❌ Invalid OTP');
            return res.json({ 
                success: false, 
                message: 'Invalid OTP. Please check and try again.' 
            });
        }

        // OTP is valid - delete it and generate session token
        otpStore.delete(email);
        
        const sessionToken = crypto.randomBytes(32).toString('hex');
        
        console.log('✅ OTP verified successfully');
        res.json({ 
            success: true, 
            message: 'Login successful',
            token: sessionToken 
        });

    } catch (error) {
        console.error('❌ Verify OTP error:', error);
        res.json({ 
            success: false, 
            message: 'Verification failed. Please try again.' 
        });
    }
});

// 3. Send Booking Approval Email Function
async function sendBookingApprovalEmail(bookingData) {
    try {
        const { email, full_name, booking_id, package_price, event_date } = bookingData;
        
        const brevoData = {
            sender: {
                name: BREVO_FROM_NAME,
                email: BREVO_FROM_EMAIL
            },
            to: [
                {
                    email: email,
                    name: full_name
                }
            ],
            subject: '🎉 Your Booking Has Been Approved! - Zaf\'s Kitchen',
            htmlContent: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset='UTF-8'>
                    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                    <title>Booking Approved</title>
                </head>
                <body style='font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;'>
                    <div style='max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;'>
                        <div style='text-align: center; margin-bottom: 30px;'>
                            <h1 style='color: #DC2626; margin: 0; font-size: 32px;'>Zaf's Kitchen</h1>
                            <p style='color: #666; margin: 5px 0 0 0; font-size: 14px;'>Catering Services</p>
                        </div>
                        
                        <div style='background: linear-gradient(135deg, #d4edda, #c3e6cb); padding: 30px; text-align: center; margin: 30px 0; border-radius: 12px; border-left: 5px solid #28a745;'>
                            <h2 style='color: #155724; margin: 0 0 15px 0; font-size: 28px;'>🎉 Booking Approved!</h2>
                            <p style='color: #155724; margin: 0; font-size: 16px;'>Your booking request has been approved!</p>
                        </div>
                        
                        <div style='background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;'>
                            <h3 style='color: #DC2626; margin-top: 0;'>Booking Details</h3>
                            <table style='width: 100%; border-collapse: collapse;'>
                                <tr>
                                    <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Booking ID:</strong></td>
                                    <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'>${booking_id}</td>
                                </tr>
                                <tr>
                                    <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Customer Name:</strong></td>
                                    <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'>${full_name}</td>
                                </tr>
                                <tr>
                                    <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Event Date:</strong></td>
                                    <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'>${new Date(event_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                                </tr>
                                <tr>
                                    <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>Total Amount:</strong></td>
                                    <td style='padding: 8px 0; border-bottom: 1px solid #dee2e6;'><strong>₱${parseFloat(package_price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                                </tr>
                            </table>
                        </div>

                        <div style='background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;'>
                            <h3 style='color: #856404; margin-top: 0;'>⏰ Important Payment Deadline</h3>
                            <p style='color: #856404; margin: 10px 0;'><strong>You have 20 hours to complete your payment.</strong></p>
                            <p style='color: #856404; margin: 10px 0;'>If payment is not received within 20 hours, your booking will be automatically cancelled.</p>
                        </div>

                        <div style='background-color: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 8px; padding: 20px; margin: 25px 0;'>
                            <h3 style='color: #004085; margin-top: 0;'>💰 Payment Instructions</h3>
                            <p style='color: #004085; margin: 15px 0;'><strong>GCash Payment:</strong></p>
                            <div style='background-color: white; padding: 15px; border-radius: 6px; margin: 10px 0;'>
                                <p style='margin: 5px 0;'><strong>GCash Number:</strong> <span style='color: #DC2626; font-size: 18px;'>0917 123 4567</span></p>
                                <p style='margin: 5px 0;'><strong>Account Name:</strong> ZAF'S KITCHEN</p>
                                <p style='margin: 5px 0;'><strong>Amount:</strong> ₱${parseFloat(package_price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <p style='color: #004085; margin: 10px 0; font-size: 14px;'><strong>Important:</strong> After payment, please save the transaction reference number and send it to us via our Facebook page or contact number for verification.</p>
                        </div>

                        <div style='background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 20px; margin: 25px 0;'>
                            <h3 style='color: #0c5460; margin-top: 0;'>📞 Contact Information</h3>
                            <p style='color: #0c5460; margin: 8px 0;'><strong>Facebook:</strong> <a href='https://facebook.com/zafskitchen' style='color: #DC2626;'>Zaf's Kitchen Official</a></p>
                            <p style='color: #0c5460; margin: 8px 0;'><strong>Phone:</strong> 0917 123 4567</p>
                            <p style='color: #0c5460; margin: 8px 0;'><strong>Email:</strong> zafskitchen95@gmail.com</p>
                        </div>

                        <div style='text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;'>
                            <p style='font-size: 14px; color: #666; margin: 0;'>Thank you for choosing Zaf's Kitchen!</p>
                            <p style='font-size: 12px; color: #999; margin: 10px 0 0 0;'>© ${new Date().getFullYear()} Zaf's Kitchen. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const response = await axios.post(
            'https://api.brevo.com/v3/smtp/email',
            brevoData,
            {
                headers: {
                    'api-key': BREVO_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.status === 201) {
            console.log(`✅ Booking approval email sent to ${email}`);
            return { success: true, message: 'Email sent successfully' };
        } else {
            throw new Error(`Brevo API returned status: ${response.status}`);
        }

    } catch (error) {
        console.error('❌ Send booking approval email error:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

// 4. Send Booking Approval Endpoint
app.post('/api/send-booking-approval', async (req, res) => {
    const { bookingData } = req.body;

    try {
        console.log(`📧 Sending booking approval email for booking: ${bookingData.booking_id}`);
        
        const result = await sendBookingApprovalEmail(bookingData);
        
        if (result.success) {
            res.json({ success: true, message: 'Booking approval email sent successfully' });
        } else {
            res.json({ success: false, message: result.error });
        }
    } catch (error) {
        console.error('❌ Send booking approval error:', error);
        res.json({ success: false, message: 'Failed to send booking approval email' });
    }
});

// 5. Send Booking Cancellation Email Function
async function sendBookingCancellationEmail(bookingData) {
    try {
        const { email, full_name, booking_id } = bookingData;
        
        const brevoData = {
            sender: {
                name: BREVO_FROM_NAME,
                email: BREVO_FROM_EMAIL
            },
            to: [
                {
                    email: email,
                    name: full_name
                }
            ],
            subject: '❌ Booking Cancelled - Zaf\'s Kitchen',
            htmlContent: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset='UTF-8'>
                    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                    <title>Booking Cancelled</title>
                </head>
                <body style='font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;'>
                    <div style='max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;'>
                        <div style='text-align: center; margin-bottom: 30px;'>
                            <h1 style='color: #DC2626; margin: 0; font-size: 32px;'>Zaf's Kitchen</h1>
                        </div>
                        
                        <div style='background: #f8d7da; padding: 30px; text-align: center; margin: 30px 0; border-radius: 12px; border-left: 5px solid #dc3545;'>
                            <h2 style='color: #721c24; margin: 0 0 15px 0; font-size: 28px;'>❌ Booking Cancelled</h2>
                            <p style='color: #721c24; margin: 0; font-size: 16px;'>Your booking has been cancelled due to non-payment.</p>
                        </div>
                        
                        <div style='background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;'>
                            <h3 style='color: #DC2626; margin-top: 0;'>Booking Details</h3>
                            <p><strong>Booking ID:</strong> ${booking_id}</p>
                            <p><strong>Customer Name:</strong> ${full_name}</p>
                            <p><strong>Reason for Cancellation:</strong> Payment was not received within the 20-hour deadline.</p>
                        </div>

                        <div style='background-color: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 8px; padding: 20px; margin: 25px 0;'>
                            <h3 style='color: #004085; margin-top: 0;'>💡 Need Assistance?</h3>
                            <p style='color: #004085; margin: 10px 0;'>If you still wish to proceed with your booking or encountered issues with payment, please contact us immediately.</p>
                            <p style='color: #004085; margin: 8px 0;'><strong>Contact:</strong> 0917 123 4567</p>
                            <p style='color: #004085; margin: 8px 0;'><strong>Email:</strong> zafskitchen95@gmail.com</p>
                        </div>

                        <div style='text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;'>
                            <p style='font-size: 14px; color: #666; margin: 0;'>We hope to serve you in the future!</p>
                            <p style='font-size: 12px; color: #999; margin: 10px 0 0 0;'>© ${new Date().getFullYear()} Zaf's Kitchen. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const response = await axios.post(
            'https://api.brevo.com/v3/smtp/email',
            brevoData,
            {
                headers: {
                    'api-key': BREVO_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.status === 201) {
            console.log(`✅ Cancellation email sent to ${email}`);
            return { success: true, message: 'Cancellation email sent successfully' };
        } else {
            throw new Error(`Brevo API returned status: ${response.status}`);
        }

    } catch (error) {
        console.error('❌ Send cancellation email error:', error);
        return { success: false, error: error.message };
    }
}

// 6. Send Booking Cancellation Endpoint
app.post('/api/send-booking-cancellation', async (req, res) => {
    const { bookingData } = req.body;

    try {
        console.log(`📧 Sending cancellation email for booking: ${bookingData.booking_id}`);
        
        const result = await sendBookingCancellationEmail(bookingData);
        
        if (result.success) {
            res.json({ success: true, message: 'Cancellation email sent successfully' });
        } else {
            res.json({ success: false, message: result.error });
        }
    } catch (error) {
        console.error('❌ Send cancellation email error:', error);
        res.json({ success: false, message: 'Failed to send cancellation email' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📧 Admin email: ${ADMIN_EMAIL}`);
    console.log(`📧 Brevo sender: ${BREVO_FROM_NAME} <${BREVO_FROM_EMAIL}>`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
}); 