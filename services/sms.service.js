import axios from "axios";

export const sendOtpSms = async (mobile, otp) => {
    console.log("Sending OTP to mobile:", mobile, "with OTP:", otp);
    
  return axios.post(
    "https://www.fast2sms.com/dev/bulkV2",
    {
      route: "otp",
      variables_values: otp,
      numbers: mobile,
    },
    {
      headers: {
        authorization: process.env.FAST2SMS_API_KEY,
        "Content-Type": "application/json",
      },
    }
  );
};
