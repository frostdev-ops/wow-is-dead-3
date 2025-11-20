package com.wowid3.tracker;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;

public class Config {
    private static final File CONFIG_FILE = FabricLoader.getInstance().getConfigDir().resolve("wowid3-tracker.json").toFile();
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public String apiUrl = "http://localhost:8080";
    public String secret = "changeme";

    public static Config load() {
        if (CONFIG_FILE.exists()) {
            try (FileReader reader = new FileReader(CONFIG_FILE)) {
                return GSON.fromJson(reader, Config.class);
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
        Config config = new Config();
        config.save();
        return config;
    }

    public void save() {
        try (FileWriter writer = new FileWriter(CONFIG_FILE)) {
            GSON.toJson(this, writer);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}

