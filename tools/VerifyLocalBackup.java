import java.nio.file.*;
import java.sql.*;
import org.h2.tools.Restore;
/** Restores only into a new folder and opens that copy; never touches the live file. */
public class VerifyLocalBackup {
    public static void main(String[] args)throws Exception{
        Path archive=Path.of(args[0]).toRealPath(),destination=Path.of(args[1]).toAbsolutePath().normalize();
        if(Files.exists(destination))throw new IllegalArgumentException("Destination already exists; choose a new folder.");
        Files.createDirectories(destination);Restore.execute(archive.toString(),destination.toString(),"marble");
        if(!Files.exists(destination.resolve("marble.mv.db")))throw new IllegalStateException("Archive did not contain the database file");
        String url="jdbc:h2:file:"+destination.resolve("marble").toString().replace('\\','/')+";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE";
        String password=System.getenv("DB_PASSWORD");if(password==null)throw new IllegalArgumentException("Load the matching private configuration first");
        try(var connection=DriverManager.getConnection(url,"sa",password);var statement=connection.createStatement()){
            for(String table:new String[]{"factures","bon_achats","payments","document_counters"})try(var rows=statement.executeQuery("SELECT COUNT(*) FROM "+table)){rows.next();System.out.println(table+": "+rows.getLong(1));}
            statement.execute("SHUTDOWN");
        }
        System.out.println("Backup restored and opened successfully in: "+destination);
    }
}
