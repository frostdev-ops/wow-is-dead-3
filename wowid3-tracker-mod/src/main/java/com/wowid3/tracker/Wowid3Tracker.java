package com.wowid3.tracker;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.fabricmc.fabric.api.message.v1.ServerMessageEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.fabricmc.fabric.api.entity.event.v1.ServerEntityCombatEvents;
import net.minecraft.block.Block;
import net.minecraft.item.ItemStack;
import net.minecraft.util.ActionResult;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.damage.DamageSource;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.*;

public class Wowid3Tracker implements ModInitializer {
    public static final Logger LOGGER = LoggerFactory.getLogger("wowid3-tracker");
    private static Config CONFIG;
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(3))
            .build();
    private static final Gson GSON = new Gson();
    
    // Background executor for queue processing
    private static final ScheduledExecutorService SCHEDULER = Executors.newSingleThreadScheduledExecutor();
    
    // Bounded queue for stats events
    private static final Queue<PlayerStatEvent> EVENT_QUEUE = new ConcurrentLinkedQueue<>();
    private static final int MAX_QUEUE_SIZE = 10000;
    private static final int BATCH_SIZE = 20;
    
    private static int tickCounter = 0;
    private static final int UPDATE_INTERVAL = 100; // 5 seconds for full state update
    private static final int PLAYTIME_INTERVAL = 20; // 1 second for playtime

    @Override
    public void onInitialize() {
        LOGGER.info("Initializing WOWID3 Tracker");
        CONFIG = Config.load();

        // Register Event Listeners
        registerEventListeners();
        
        // Start background processor
        SCHEDULER.scheduleAtFixedRate(this::processEventQueue, 1, 1, TimeUnit.SECONDS);
    }

    private void registerEventListeners() {
        // Full State Updates
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> updateServerState(server));
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> updateServerState(server));

        // Chat
        ServerMessageEvents.CHAT_MESSAGE.register((message, sender, params) -> {
            if (sender != null) {
                submitChatMessage(sender.getName().getString(), message.getContent().getString());
            }
        });

        // Block Break
        PlayerBlockBreakEvents.AFTER.register((world, player, pos, state, blockEntity) -> {
            if (!world.isClient && player instanceof ServerPlayerEntity) {
                String itemId = state.getBlock().getRegistryEntry().registryKey().getValue().toString();
                queueEvent(new PlayerStatEvent(
                    player.getUuidAsString(),
                    player.getName().getString(),
                    "BlockBroken",
                    itemId
                ));
                
                // Check if it's an ore
                String blockId = itemId.toLowerCase();
                if (blockId.contains("ore") || blockId.contains("_ore")) {
                    queueEvent(new PlayerStatEvent(
                        player.getUuidAsString(),
                        player.getName().getString(),
                        "OreMined",
                        itemId
                    ));
                }
            }
        });
        
        // Block Place (via UseBlockCallback - tracks when player right-clicks with item)
        UseBlockCallback.EVENT.register((player, world, hand, hitResult) -> {
            if (!world.isClient && player instanceof ServerPlayerEntity) {
                ItemStack stack = player.getStackInHand(hand);
                if (!stack.isEmpty()) {
                    String itemId = stack.getItem().getRegistryEntry().registryKey().getValue().toString();
                    // Only track if it's a block item
                    if (stack.getItem() instanceof net.minecraft.item.BlockItem) {
                        queueEvent(new PlayerStatEvent(
                            player.getUuidAsString(),
                            player.getName().getString(),
                            "BlockPlaced",
                            itemId
                        ));
                    } else {
                        // Track as item gathered
                        queueEvent(new PlayerStatEvent(
                            player.getUuidAsString(),
                            player.getName().getString(),
                            "ItemGathered",
                            itemId,
                            stack.getCount()
                        ));
                    }
                }
            }
            return ActionResult.PASS;
        });

        // Mobs Killed & Damage
        ServerLivingEntityEvents.AFTER_DEATH.register((entity, source) -> {
            if (entity.getWorld().isClient) return;
            
            // Mob Killed by Player
            if (source.getAttacker() instanceof ServerPlayerEntity player) {
                String entityId = entity.getType().getRegistryEntry().registryKey().getValue().toString();
                queueEvent(new PlayerStatEvent(
                    player.getUuidAsString(),
                    player.getName().getString(),
                    "MobKilled",
                    entityId
                ));
            }
        });
        
        // Combat Events (Damage Dealt)
        ServerEntityCombatEvents.AFTER_KILLED_OTHER_ENTITY.register((world, entity, killedEntity) -> {
             if (entity instanceof ServerPlayerEntity player) {
                 // We can't easily get exact damage here, but killing counts as an interaction
                 // For actual damage dealing tracking we'd need a mixin or more complex event handling
                 // Fabric API doesn't have a simple "DamageDealt" event that exposes amount easily without mixins
             }
        });

        // Tick Events (Playtime & Periodic Updates)
        ServerTickEvents.END_SERVER_TICK.register(server -> {
            tickCounter++;
            
            // Update playtime every second
            if (tickCounter % PLAYTIME_INTERVAL == 0) {
                for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
                    queueEvent(new PlayerStatEvent(
                        player.getUuidAsString(),
                        player.getName().getString(),
                        "Playtime",
                        null,
                        1 // 1 second
                    ));
                    
                    // Track biome/dimension periodically (every 5s) to avoid spam
                    if (tickCounter % UPDATE_INTERVAL == 0) {
                        trackLocation(player);
                    }
                }
            }

            // Periodic full state sync
            if (tickCounter >= UPDATE_INTERVAL) {
                tickCounter = 0;
                updateServerState(server);
            }
        });
    }
    
    private void trackLocation(ServerPlayerEntity player) {
        String biome = player.getWorld().getRegistryManager()
                .get(RegistryKeys.BIOME)
                .getId(player.getWorld().getBiome(player.getBlockPos()).value())
                .toString();
        
        String dimension = player.getWorld().getRegistryKey().getValue().toString();
        
        queueEvent(new PlayerStatEvent(
            player.getUuidAsString(),
            player.getName().getString(),
            "BiomeVisited",
            biome
        ));
        
        queueEvent(new PlayerStatEvent(
            player.getUuidAsString(),
            player.getName().getString(),
            "DimensionVisited",
            dimension
        ));
    }

    private void queueEvent(PlayerStatEvent event) {
        if (EVENT_QUEUE.size() >= MAX_QUEUE_SIZE) {
            // Drop event if queue full
            return;
        }
        EVENT_QUEUE.offer(event);
    }

    private void processEventQueue() {
        if (EVENT_QUEUE.isEmpty()) return;

        List<PlayerStatEvent> batch = new ArrayList<>();
        while (batch.size() < BATCH_SIZE && !EVENT_QUEUE.isEmpty()) {
            batch.add(EVENT_QUEUE.poll());
        }

        if (batch.isEmpty()) return;

        try {
            StatEventBatch eventBatch = new StatEventBatch(batch);
            String json = GSON.toJson(eventBatch);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(CONFIG.apiUrl + "/api/tracker/stats-events"))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + CONFIG.secret)
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();

            HTTP_CLIENT.sendAsync(httpRequest, HttpResponse.BodyHandlers.discarding())
                    .thenAccept(response -> {
                        if (response.statusCode() != 202) {
                            LOGGER.warn("Failed to submit stats batch: HTTP {}", response.statusCode());
                        }
                    });
        } catch (Exception e) {
            LOGGER.error("Error processing stats queue", e);
        }
    }

    // Keep existing methods for legacy compatibility
    private void updateServerState(MinecraftServer server) {
        SCHEDULER.submit(() -> {
            try {
                List<PlayerExt> players = new ArrayList<>();
                float tps = 20.0f;
                float mspt = server.getTickTime();
                if (mspt > 50.0) {
                    tps = 1000.0f / mspt;
                }

                for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
                    String biome = player.getWorld().getRegistryManager()
                            .get(RegistryKeys.BIOME)
                            .getId(player.getWorld().getBiome(player.getBlockPos()).value())
                            .toString();
                    
                    String dimension = player.getWorld().getRegistryKey().getValue().toString();
                    
                    players.add(new PlayerExt(
                            player.getName().getString(),
                            player.getUuidAsString(),
                            new double[]{player.getX(), player.getY(), player.getZ()},
                            dimension,
                            biome
                    ));
                }

                UpdateStateRequest request = new UpdateStateRequest(players, tps, mspt);
                String json = GSON.toJson(request);

                HttpRequest httpRequest = HttpRequest.newBuilder()
                        .uri(URI.create(CONFIG.apiUrl + "/api/tracker/update"))
                        .header("Content-Type", "application/json")
                        .header("Authorization", "Bearer " + CONFIG.secret)
                        .POST(HttpRequest.BodyPublishers.ofString(json))
                        .build();

                HTTP_CLIENT.sendAsync(httpRequest, HttpResponse.BodyHandlers.discarding());

            } catch (Exception e) {
                LOGGER.error("Error updating tracker state", e);
            }
        });
    }

    private void submitChatMessage(String sender, String content) {
        SCHEDULER.submit(() -> {
            try {
                JsonObject json = new JsonObject();
                json.addProperty("sender", sender);
                json.addProperty("content", content);

                HttpRequest httpRequest = HttpRequest.newBuilder()
                        .uri(URI.create(CONFIG.apiUrl + "/api/tracker/chat"))
                        .header("Content-Type", "application/json")
                        .header("Authorization", "Bearer " + CONFIG.secret)
                        .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(json)))
                        .build();

                HTTP_CLIENT.sendAsync(httpRequest, HttpResponse.BodyHandlers.discarding());
            } catch (Exception e) {
                LOGGER.error("Error submitting chat message", e);
            }
        });
    }

    // Data classes
    private static class PlayerExt {
        String name;
        String uuid;
        double[] position;
        String dimension;
        String biome;

        public PlayerExt(String name, String uuid, double[] position, String dimension, String biome) {
            this.name = name;
            this.uuid = uuid;
            this.position = position;
            this.dimension = dimension;
            this.biome = biome;
        }
    }

    private static class UpdateStateRequest {
        List<PlayerExt> players;
        float tps;
        float mspt;

        public UpdateStateRequest(List<PlayerExt> players, float tps, float mspt) {
            this.players = players;
            this.tps = tps;
            this.mspt = mspt;
        }
    }
    
    private static class StatEventBatch {
        List<PlayerStatEvent> events;
        
        public StatEventBatch(List<PlayerStatEvent> events) {
            this.events = events;
        }
    }
    
    private static class PlayerStatEvent {
        String uuid;
        String username;
        long timestamp;
        StatEvent event;
        
        public PlayerStatEvent(String uuid, String username, String type, String id) {
            this(uuid, username, type, id, 0);
        }
        
        public PlayerStatEvent(String uuid, String username, String type, String id, long value) {
            this.uuid = uuid;
            this.username = username;
            this.timestamp = System.currentTimeMillis() / 1000;
            
            switch (type) {
                case "BlockBroken": this.event = new StatEvent("BlockBroken", id, null, null, null, null, null, null, null); break;
                case "BlockPlaced": this.event = new StatEvent("BlockPlaced", id, null, null, null, null, null, null, null); break;
                case "MobKilled": this.event = new StatEvent("MobKilled", null, id, null, null, null, null, null, null); break;
                case "MobTamed": this.event = new StatEvent("MobTamed", null, id, null, null, null, null, null, null); break;
                case "OreMined": this.event = new StatEvent("OreMined", null, null, id, null, null, null, null, null); break;
                case "ItemGathered": this.event = new StatEvent("ItemGathered", id, null, null, null, null, null, null, value); break;
                case "DamageDealt": this.event = new StatEvent("DamageDealt", null, null, null, null, null, (double)value, null, null); break;
                case "DamageTaken": this.event = new StatEvent("DamageTaken", null, null, null, null, null, null, (double)value, null); break;
                case "DimensionVisited": this.event = new StatEvent("DimensionVisited", null, null, null, id, null, null, null, null); break;
                case "BiomeVisited": this.event = new StatEvent("BiomeVisited", null, null, null, null, id, null, null, null); break;
                case "Playtime": this.event = new StatEvent("Playtime", null, null, null, null, null, null, null, value); break;
            }
        }
    }
    
    private static class StatEvent {
        @com.google.gson.annotations.SerializedName("type")
        String type;
        @com.google.gson.annotations.SerializedName("item_id")
        String item_id;
        @com.google.gson.annotations.SerializedName("entity_id")
        String entity_id;
        @com.google.gson.annotations.SerializedName("block_id")
        String block_id;
        @com.google.gson.annotations.SerializedName("dimension_id")
        String dimension_id;
        @com.google.gson.annotations.SerializedName("biome_id")
        String biome_id;
        @com.google.gson.annotations.SerializedName("count")
        Long count;
        @com.google.gson.annotations.SerializedName("amount")
        Double amount;
        @com.google.gson.annotations.SerializedName("seconds")
        Long seconds;
        
        public StatEvent(String type, String item_id, String entity_id, String block_id, 
                        String dimension_id, String biome_id, Double amount, Double damage_taken, Long seconds) {
            this.type = type;
            this.item_id = item_id;
            this.entity_id = entity_id;
            this.block_id = block_id;
            this.dimension_id = dimension_id;
            this.biome_id = biome_id;
            this.amount = amount;
            this.seconds = seconds;
            // For ItemGathered, seconds field is used for count
            if (type.equals("ItemGathered")) {
                this.count = seconds;
                this.seconds = null;
            }
        }
    }
}
