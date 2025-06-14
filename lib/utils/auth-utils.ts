// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getManagementApiToken = async (session: any) => {
  if (!session?.user?.sub) {
    console.error("No user session or sub found");
    throw new Error("No user session found");
  }

  if (
    !process.env.AUTH0_DOMAIN ||
    !process.env.AUTH0_M2M_CLIENT_ID ||
    !process.env.AUTH0_M2M_CLIENT_SECRET ||
    !process.env.AUTH0_AUDIENCE
  ) {
    console.error("Missing Auth0 environment variables");
    throw new Error("Auth0 configuration missing");
  }

  try {
    console.log("Getting access token for Management API...");

    // Get Management API token
    const tokenResponse = await fetch(
      `https://invisible-tech.auth0.com/oauth/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.AUTH0_M2M_CLIENT_ID,
          client_secret: process.env.AUTH0_M2M_CLIENT_SECRET,
          audience: "https://invisible-tech.auth0.com/api/v2/",
          grant_type: "client_credentials",
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token request failed:", tokenResponse.status, errorText);
      throw new Error(`Failed to get access token: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error("No access token in response:", tokenData);
      throw new Error("No access token received");
    }

    console.log("Access token received, fetching user info...");
    return tokenData;
  } catch (error) {
    console.error("Error retrieving access token", error);
    throw error;
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getUserInfoFromAPI = async (session: any) => {
  try {
    const tokenData = await getManagementApiToken(session);
    if (!tokenData.access_token) {
      console.error("No access token in response:", tokenData);
      throw new Error("No access token received");
    }

    console.log("Access token received, fetching user info...");

    // Get user info from Management API
    const userInfoUrl = `https://${
      process.env.AUTH0_DOMAIN
    }/api/v2/users/${encodeURIComponent(session.user.sub)}`;

    const userResponse = await fetch(userInfoUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error(
        "User info request failed:",
        userResponse.status,
        errorText
      );
      throw new Error(`Failed to get user info: ${userResponse.status}`);
    }

    const userInfo = await userResponse.json();
    console.log("User info received:", {
      user_id: userInfo.user_id,
      email: userInfo.email,
      app_metadata: userInfo.app_metadata,
    });

    const role = userInfo.app_metadata?.role.sector_evals;

    return {
      userInfo,
      role,
      tokenData,
    };
  } catch (error) {
    console.error("Management API error:", error);
    throw error;
  }
};
