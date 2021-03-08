package com.highfidelity.hifimc;

import org.apache.commons.lang3.tuple.Pair;

import net.minecraftforge.common.ForgeConfigSpec;

public class Config {
	public static class Client {
        public final ForgeConfigSpec.ConfigValue<? extends String> hifiJwt;
		
        Client(ForgeConfigSpec.Builder builder) {
            builder.comment("Client configuration settings")
                    .push("general");

            hifiJwt = builder
                    .comment("Defines the JWT to use to connect to a High Fidelity audio space.",
                             "Visit localhost:7777 in a web browser when the mod is loaded to connect to the space.")
                    .translation("hifimc.configclient.hifiJwt")
                    .define("hifiJwt", "");

            builder.pop();
        }
	}
	
	static final ForgeConfigSpec clientSpec;
    public static final Client CLIENT;
    static {
    	final Pair<Client, ForgeConfigSpec> specPair = new ForgeConfigSpec.Builder().configure(Client::new);
    	clientSpec = specPair.getRight();
    	CLIENT = specPair.getLeft();
    }
}
